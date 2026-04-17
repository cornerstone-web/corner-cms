"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable, configTable, usersTable, userSiteRolesTable, userSiteScopesTable } from "@/db/schema";
import { getAuth0ManagementToken } from "@/lib/auth0Management";
import { resolveInviteEmailStatus } from "@/lib/utils/invite";
import { isValidScope } from "@/lib/utils/access-control";
import {
  createOrResolveAuth0User,
  generatePasswordTicket,
  sendInviteEmail,
  createOrRestoreDbUser,
  assignSiteMembership,
} from "@/lib/utils/user-helpers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Derives the list of valid collection names for a site by reading its
 * cached .pages.yml config from the DB. Falls back to [] if the config hasn't
 * been loaded yet. Never trusts caller-supplied collection names.
 */
async function getCollectionNamesForSite(siteId: string): Promise<string[]> {
  const site = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, siteId),
    columns: { githubRepoName: true },
  });
  if (!site) return [];

  const slashIndex = site.githubRepoName.indexOf("/");
  if (slashIndex === -1) return [];
  const owner = site.githubRepoName.slice(0, slashIndex);
  const repo = site.githubRepoName.slice(slashIndex + 1);

  const config = await db.query.configTable.findFirst({
    where: and(
      sql`lower(${configTable.owner}) = lower(${owner})`,
      sql`lower(${configTable.repo}) = lower(${repo})`,
    ),
    columns: { object: true },
  });
  if (!config) return [];

  const parsed = JSON.parse(config.object) as Record<string, any>;
  const content: any[] = Array.isArray(parsed.content) ? parsed.content : [];
  return content.filter((item: any) => item.type === "collection").map((item: any) => item.name as string);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; emailSent: boolean };

// ─── Access guard ─────────────────────────────────────────────────────────────

async function assertCanManageUsers(siteId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return user;
  if (
    user.siteAssignment?.siteId === siteId &&
    user.siteAssignment.isAdmin
  )
    return user;
  throw new Error("You do not have permission to manage users for this site.");
}

// ─── inviteUser ───────────────────────────────────────────────────────────────

export async function inviteUser(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const siteId = (formData.get("siteId") as string | null)?.trim() ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const isAdmin = formData.get("isAdmin") === "true";
  const scopesRaw = (formData.get("scopes") as string | null) ?? "[]";

  if (!siteId || !name || !email)
    return { status: "error", message: "All fields are required." };

  try {
    await assertCanManageUsers(siteId);

    let scopes: string[] = [];
    if (!isAdmin) {
      try {
        scopes = JSON.parse(scopesRaw);
      } catch {
        return { status: "error", message: "Invalid scopes format." };
      }
      const collectionNames = await getCollectionNamesForSite(siteId);
      const invalid = scopes.filter(s => !isValidScope(s, collectionNames));
      if (invalid.length > 0)
        return { status: "error", message: `Invalid scopes: ${invalid.join(", ")}` };
      if (scopes.length === 0)
        return { status: "error", message: "Non-admin users must have at least one scope." };
    }

    const mgmtToken = await getAuth0ManagementToken();
    const auth0UserId = await createOrResolveAuth0User(email, name, mgmtToken);
    const resetUrl = await generatePasswordTicket(auth0UserId, mgmtToken);

    const dbUserId = await createOrRestoreDbUser(auth0UserId, email, name);
    await assignSiteMembership(dbUserId, siteId, isAdmin);

    if (!isAdmin) {
      await db
        .delete(userSiteScopesTable)
        .where(
          and(
            eq(userSiteScopesTable.userId, dbUserId),
            eq(userSiteScopesTable.siteId, siteId)
          )
        );
      await db.insert(userSiteScopesTable).values(
        scopes.map(scope => ({ userId: dbUserId, siteId, scope }))
      );
    }

    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.id, siteId),
      columns: { displayName: true },
    });
    const emailSent = await sendInviteEmail(email, name, site?.displayName ?? "your site", resetUrl);

    return resolveInviteEmailStatus(emailSent);
  } catch (err: unknown) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

// ─── resendInvite ─────────────────────────────────────────────────────────────

export async function resendInvite(
  siteId: string,
  userId: string,
): Promise<{ ok: boolean; inviteUrl: string | null; emailSent: boolean; error?: string }> {
  try {
    await assertCanManageUsers(siteId);

    const dbUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!dbUser) throw new Error("User not found.");

    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.id, siteId),
      columns: { displayName: true },
    });

    const mgmtToken = await getAuth0ManagementToken();
    const inviteUrl = await generatePasswordTicket(dbUser.auth0Id, mgmtToken);
    const emailSent = await sendInviteEmail(
      dbUser.email,
      dbUser.name,
      site?.displayName ?? "your site",
      inviteUrl,
    );

    return { ok: true, inviteUrl, emailSent };
  } catch (err: unknown) {
    return {
      ok: false,
      inviteUrl: null,
      emailSent: false,
      error: err instanceof Error ? err.message : "Failed to resend invite.",
    };
  }
}

// ─── updateUserAccess ─────────────────────────────────────────────────────────

export async function updateUserAccess(
  siteId: string,
  userId: string,
  isAdmin: boolean,
  scopes: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManageUsers(siteId);

    // Verify the target user is an active member of this site
    const membership = await db.query.userSiteRolesTable.findFirst({
      where: and(
        eq(userSiteRolesTable.siteId, siteId),
        eq(userSiteRolesTable.userId, userId),
        isNull(userSiteRolesTable.deletedAt)
      ),
    });
    if (!membership) throw new Error("User is not a member of this site.");

    if (!isAdmin) {
      const collectionNames = await getCollectionNamesForSite(siteId);
      const invalid = scopes.filter(s => !isValidScope(s, collectionNames));
      if (invalid.length > 0)
        throw new Error(`Invalid scopes: ${invalid.join(", ")}`);
      if (scopes.length === 0)
        throw new Error("Non-admin users must have at least one scope.");
    }

    await db
      .update(userSiteRolesTable)
      .set({ isAdmin })
      .where(
        and(
          eq(userSiteRolesTable.siteId, siteId),
          eq(userSiteRolesTable.userId, userId),
          isNull(userSiteRolesTable.deletedAt)
        )
      );

    // Always reconcile scopes: clear existing, then insert new (skip insert for admins)
    await db
      .delete(userSiteScopesTable)
      .where(
        and(
          eq(userSiteScopesTable.userId, userId),
          eq(userSiteScopesTable.siteId, siteId)
        )
      );

    if (!isAdmin && scopes.length > 0) {
      await db.insert(userSiteScopesTable).values(
        scopes.map(scope => ({ userId, siteId, scope }))
      );
    }

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

// ─── removeUserFromSite ───────────────────────────────────────────────────────

export async function removeUserFromSite(
  siteId: string,
  userId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManageUsers(siteId);

    const dbUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!dbUser) throw new Error("User not found.");

    const now = new Date();

    await db
      .update(userSiteRolesTable)
      .set({ deletedAt: now })
      .where(
        and(
          eq(userSiteRolesTable.siteId, siteId),
          eq(userSiteRolesTable.userId, userId),
          isNull(userSiteRolesTable.deletedAt),
        )
      );

    // Delete all scopes for this user in this site
    await db
      .delete(userSiteScopesTable)
      .where(
        and(
          eq(userSiteScopesTable.userId, userId),
          eq(userSiteScopesTable.siteId, siteId)
        )
      );

    await db
      .update(usersTable)
      .set({ deletedAt: now })
      .where(eq(usersTable.id, userId));

    const mgmtToken = await getAuth0ManagementToken();
    const deleteRes = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(dbUser.auth0Id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${mgmtToken}` } }
    );
    if (!deleteRes.ok && deleteRes.status !== 404) {
      throw new Error(`Auth0 user deletion failed (${deleteRes.status}): ${await deleteRes.text()}`);
    }

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Remove failed." };
  }
}
