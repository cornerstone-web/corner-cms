"use server";

/**
 * Lightweight provision for a new site:
 * 1. Insert sites DB record (status: provisioning)
 * 2. Create Auth0 user + password-change invite ticket
 * 3. Insert users + user_site_roles DB records
 *
 * GitHub repo creation and CF Pages setup happen during the site admin's
 * onboarding wizard (triggered on first /setup load).
 */

import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable } from "@/db/schema";
import { getAuth0ManagementToken } from "@/lib/auth0Management";
import {
  createOrResolveAuth0User,
  generatePasswordTicket,
  sendInviteEmail,
  createOrRestoreDbUser,
  assignSiteMembership,
} from "@/lib/utils/user-helpers";

export type ProvisionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; siteId: string; adminInviteUrl: string | null; emailSent: boolean; adminEmail: string };

export async function provisionSite(
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
    // 1. Upsert site record — idempotent so retries after Auth0 failure work cleanly
    let site: { id: string };
    const existingSite = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.slug, slug),
      columns: { id: true },
    });
    if (existingSite) {
      site = existingSite;
    } else {
      const [inserted] = await db
        .insert(sitesTable)
        .values({ githubRepoName, slug, displayName, status: "provisioning" })
        .returning({ id: sitesTable.id });
      site = inserted;
    }

    // 2. Create Auth0 user + invite ticket (non-fatal — site record still created if this fails)
    let auth0UserId: string | undefined;
    let adminInviteUrl: string | null = null;
    let emailSent = false;
    try {
      const mgmtToken = await getAuth0ManagementToken();
      auth0UserId = await createOrResolveAuth0User(adminEmail, adminName, mgmtToken);
      adminInviteUrl = await generatePasswordTicket(auth0UserId, mgmtToken);
      emailSent = await sendInviteEmail(adminEmail, adminName, displayName, adminInviteUrl);
    } catch (auth0Err) {
      console.error("Auth0 provisioning failed (non-fatal):", auth0Err);
    }

    // 3. Insert user + role into DB
    if (auth0UserId) {
      const dbUserId = await createOrRestoreDbUser(auth0UserId, adminEmail, adminName);
      await assignSiteMembership(dbUserId, site.id, true);
    }

    return { status: "success", siteId: site.id, adminInviteUrl, emailSent, adminEmail };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("provisionSite failed:", err);
    return { status: "error", message };
  }
}

export async function updateSiteStatus(
  siteId: string,
  status: "active" | "suspended" | "provisioning",
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getAuth();
  if (!user?.isSuperAdmin) return { ok: false, error: "Unauthorized." };

  try {
    await db
      .update(sitesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(sitesTable.id, siteId));
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}
