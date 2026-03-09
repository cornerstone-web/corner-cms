"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable } from "@/db/schema";
import { getAuth0ManagementToken } from "@/lib/auth0Management";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

// ─── Access guard ─────────────────────────────────────────────────────────────

async function assertCanManageUsers(churchId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return user;
  if (
    user.churchAssignment?.churchId === churchId &&
    user.churchAssignment.role === "church_admin"
  )
    return user;
  throw new Error("You do not have permission to manage users for this site.");
}

// ─── inviteUser ───────────────────────────────────────────────────────────────

export async function inviteUser(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const churchId = (formData.get("churchId") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const role = (formData.get("role") as string | null) ?? "editor";

  if (!churchId || !name || !email)
    return { status: "error", message: "All fields are required." };
  if (!["church_admin", "editor"].includes(role))
    return { status: "error", message: "Invalid role." };

  try {
    await assertCanManageUsers(churchId);

    const mgmtToken = await getAuth0ManagementToken();

    // Create or find Auth0 user
    let auth0UserId: string | undefined;
    const createRes = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection: "Username-Password-Authentication",
          email,
          name,
          password: `${crypto.randomUUID()}Aa1!`,
          email_verified: false,
          blocked: false,
        }),
      }
    );

    if (createRes.ok) {
      auth0UserId = ((await createRes.json()) as any).user_id as string;
    } else {
      const err = await createRes.json();
      if (err.statusCode === 409) {
        // User exists — look up by email
        const searchRes = await fetch(
          `https://${process.env.AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
          { headers: { Authorization: `Bearer ${mgmtToken}` } }
        );
        if (searchRes.ok) {
          const existing = await searchRes.json();
          auth0UserId = existing[0]?.user_id as string | undefined;
        }
      } else {
        throw new Error(`Auth0 user creation failed: ${err.message ?? createRes.status}`);
      }
    }

    if (!auth0UserId) throw new Error("Could not resolve Auth0 user.");

    // Send password-change (invite) ticket
    await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/tickets/password-change`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: auth0UserId,
          result_url: process.env.APP_BASE_URL ?? "/",
          ttl_sec: 604800,
          mark_email_as_verified: true,
        }),
      }
    );

    // Upsert DB user
    const existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.auth0Id, auth0UserId),
    });
    const dbUserId =
      existing?.id ??
      (
        await db
          .insert(usersTable)
          .values({ auth0Id: auth0UserId, email, name })
          .returning({ id: usersTable.id })
      )[0].id;

    // Check for existing (possibly soft-deleted) role row
    const existingRole = await db.query.userChurchRolesTable.findFirst({
      where: and(
        eq(userChurchRolesTable.userId, dbUserId),
        eq(userChurchRolesTable.churchId, churchId)
      ),
    });

    if (existingRole) {
      // Restore and update role
      await db
        .update(userChurchRolesTable)
        .set({ role: role as "church_admin" | "editor", deletedAt: null })
        .where(eq(userChurchRolesTable.id, existingRole.id));
    } else {
      await db.insert(userChurchRolesTable).values({
        userId: dbUserId,
        churchId,
        role: role as "church_admin" | "editor",
      });
    }

    return { status: "success" };
  } catch (err: unknown) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

// ─── updateUserRole ───────────────────────────────────────────────────────────

export async function updateUserRole(
  churchId: string,
  userId: string,
  role: "church_admin" | "editor"
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManageUsers(churchId);
    await db
      .update(userChurchRolesTable)
      .set({ role })
      .where(
        and(
          eq(userChurchRolesTable.churchId, churchId),
          eq(userChurchRolesTable.userId, userId),
          isNull(userChurchRolesTable.deletedAt)
        )
      );
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

// ─── removeUserFromChurch ─────────────────────────────────────────────────────

export async function removeUserFromChurch(
  churchId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManageUsers(churchId);
    await db
      .update(userChurchRolesTable)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(userChurchRolesTable.churchId, churchId),
          eq(userChurchRolesTable.userId, userId),
          isNull(userChurchRolesTable.deletedAt)
        )
      );
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Remove failed." };
  }
}
