"use server";

/**
 * Lightweight provision for a new church:
 * 1. Insert churches DB record (status: provisioning)
 * 2. Create Auth0 user + password-change invite ticket
 * 3. Insert users + user_church_roles DB records
 *
 * GitHub repo creation and CF Pages setup happen during the church admin's
 * onboarding wizard (triggered on first /setup load).
 */

import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable } from "@/db/schema";
import { getAuth0ManagementToken } from "@/lib/auth0Management";

export type ProvisionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; churchId: string; adminInviteUrl: string | null; emailSent: boolean; adminEmail: string };

export async function provisionChurch(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const { user } = await getAuth();
  if (!user?.isSuperAdmin) return { status: "error", message: "Unauthorized." };

  const displayName = (formData.get("displayName") as string | null)?.trim() ?? "";
  const slug = (formData.get("slug") as string | null)?.trim().toLowerCase() ?? "";
  const adminEmail = (formData.get("adminEmail") as string | null)?.trim().toLowerCase() ?? "";
  const adminName = (formData.get("adminName") as string | null)?.trim() ?? "";

  if (!displayName || !slug || !adminEmail || !adminName) {
    return { status: "error", message: "All fields are required." };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return {
      status: "error",
      message: "Slug must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen.",
    };
  }

  const org = process.env.GITHUB_ORG ?? "cornerstone-web";
  const githubRepoName = `${org}/${slug}`;

  try {
    // 1. Insert church record
    const [church] = await db
      .insert(churchesTable)
      .values({ githubRepoName, slug, displayName, status: "provisioning" })
      .returning({ id: churchesTable.id });

    // 2. Create Auth0 user + invite ticket
    let auth0UserId: string | undefined;
    let adminInviteUrl: string | null = null;
    let emailSent = false;
    try {
      const mgmtToken = await getAuth0ManagementToken();

      const createUserRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection: "Username-Password-Authentication",
          email: adminEmail,
          name: adminName,
          // Random password — the invite ticket forces a reset, so this is never used
          password: `${crypto.randomUUID()}Aa1!`,
          email_verified: false,
          blocked: false,
        }),
      });

      if (createUserRes.ok) {
        const auth0User = await createUserRes.json();
        auth0UserId = auth0User.user_id as string;
      } else {
        const errBody = await createUserRes.json();
        if (errBody.statusCode === 409) {
          // User exists — look up by email
          const searchRes = await fetch(
            `https://${process.env.AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(adminEmail)}`,
            { headers: { Authorization: `Bearer ${mgmtToken}` } },
          );
          if (searchRes.ok) {
            const existing = await searchRes.json();
            auth0UserId = existing[0]?.user_id as string | undefined;
          }
        } else {
          console.error("Auth0 user creation failed (non-fatal):", errBody);
        }
      }

      // Generate password-change (invite) ticket and capture the URL
      if (auth0UserId) {
        const ticketRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/tickets/password-change`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mgmtToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: auth0UserId,
            result_url: process.env.APP_BASE_URL ?? "/",
            ttl_sec: 604800, // 7 days
            mark_email_as_verified: true,
          }),
        });
        if (ticketRes.ok) {
          const ticketData = await ticketRes.json();
          adminInviteUrl = ticketData.ticket as string ?? null;
        }

        // Send invite email via corner-apostle
        if (adminInviteUrl) {
          try {
            const inviteRes = await fetch(`${process.env.CORNER_APOSTLE_URL}/send-invite`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.CORNERSTONE_INTERNAL_SECRET ?? ""}`,
              },
              body: JSON.stringify({
                to: adminEmail,
                name: adminName,
                siteName: displayName,
                resetUrl: adminInviteUrl,
              }),
            });
            emailSent = inviteRes.ok;
            if (!inviteRes.ok) {
              console.error("Invite email failed (non-fatal):", await inviteRes.text());
            }
          } catch (emailErr) {
            console.error("Invite email error (non-fatal):", emailErr);
          }
        }
      }
    } catch (auth0Err) {
      console.error("Auth0 provisioning failed (non-fatal):", auth0Err);
    }

    // 3. Insert user + role into DB
    if (auth0UserId) {
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.auth0Id, auth0UserId),
      });
      const dbUserId = existing?.id ?? (
        await db
          .insert(usersTable)
          .values({ auth0Id: auth0UserId, email: adminEmail, name: adminName })
          .returning({ id: usersTable.id })
      )[0].id;

      await db.insert(userChurchRolesTable).values({
        userId: dbUserId,
        churchId: church.id,
        role: "church_admin",
      });
    }

    return { status: "success", churchId: church.id, adminInviteUrl, emailSent, adminEmail };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("provisionChurch failed:", err);
    return { status: "error", message };
  }
}

export async function updateChurchStatus(
  churchId: string,
  status: "active" | "suspended" | "provisioning",
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getAuth();
  if (!user?.isSuperAdmin) return { ok: false, error: "Unauthorized." };

  try {
    await db
      .update(churchesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(churchesTable.id, churchId));
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}
