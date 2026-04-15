"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable, userChurchScopesTable } from "@/db/schema";
import { getAuth0ManagementToken } from "@/lib/auth0Management";
import { resolveInviteEmailStatus } from "@/lib/utils/invite";
import { isValidScope } from "@/lib/utils/access-control";
import {
  createOrResolveAuth0User,
  generatePasswordTicket,
  sendInviteEmail,
  createOrRestoreDbUser,
  assignChurchMembership,
} from "@/lib/utils/user-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; emailSent: boolean };

// ─── Access guard ─────────────────────────────────────────────────────────────

async function assertCanManageUsers(churchId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return user;
  if (
    user.churchAssignment?.churchId === churchId &&
    user.churchAssignment.isAdmin
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
  const isAdmin = formData.get("isAdmin") === "true";
  const scopesRaw = (formData.get("scopes") as string | null) ?? "[]";
  const collectionNamesRaw = (formData.get("collectionNames") as string | null) ?? "[]";

  if (!churchId || !name || !email)
    return { status: "error", message: "All fields are required." };

  try {
    await assertCanManageUsers(churchId);

    let scopes: string[] = [];
    let collectionNames: string[] = [];
    if (!isAdmin) {
      try {
        scopes = JSON.parse(scopesRaw);
        collectionNames = JSON.parse(collectionNamesRaw);
      } catch {
        return { status: "error", message: "Invalid scopes format." };
      }
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
    await assignChurchMembership(dbUserId, churchId, isAdmin);

    if (!isAdmin) {
      await db
        .delete(userChurchScopesTable)
        .where(
          and(
            eq(userChurchScopesTable.userId, dbUserId),
            eq(userChurchScopesTable.churchId, churchId)
          )
        );
      await db.insert(userChurchScopesTable).values(
        scopes.map(scope => ({ userId: dbUserId, churchId, scope }))
      );
    }

    const church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.id, churchId),
      columns: { displayName: true },
    });
    const emailSent = await sendInviteEmail(email, name, church?.displayName ?? "your site", resetUrl);

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
  churchId: string,
  userId: string,
): Promise<{ ok: boolean; inviteUrl: string | null; emailSent: boolean; error?: string }> {
  try {
    await assertCanManageUsers(churchId);

    const dbUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!dbUser) throw new Error("User not found.");

    const church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.id, churchId),
      columns: { displayName: true },
    });

    const mgmtToken = await getAuth0ManagementToken();
    const inviteUrl = await generatePasswordTicket(dbUser.auth0Id, mgmtToken);
    const emailSent = await sendInviteEmail(
      dbUser.email,
      dbUser.name,
      church?.displayName ?? "your site",
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
  churchId: string,
  userId: string,
  isAdmin: boolean,
  scopes: string[],
  collectionNames: string[]
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertCanManageUsers(churchId);

    // Verify the target user is an active member of this church
    const membership = await db.query.userChurchRolesTable.findFirst({
      where: and(
        eq(userChurchRolesTable.churchId, churchId),
        eq(userChurchRolesTable.userId, userId),
        isNull(userChurchRolesTable.deletedAt)
      ),
    });
    if (!membership) throw new Error("User is not a member of this church.");

    if (!isAdmin) {
      const invalid = scopes.filter(s => !isValidScope(s, collectionNames));
      if (invalid.length > 0)
        throw new Error(`Invalid scopes: ${invalid.join(", ")}`);
      if (scopes.length === 0)
        throw new Error("Non-admin users must have at least one scope.");
    }

    await db
      .update(userChurchRolesTable)
      .set({ isAdmin })
      .where(
        and(
          eq(userChurchRolesTable.churchId, churchId),
          eq(userChurchRolesTable.userId, userId),
          isNull(userChurchRolesTable.deletedAt)
        )
      );

    // Always reconcile scopes: clear existing, then insert new (skip insert for admins)
    await db
      .delete(userChurchScopesTable)
      .where(
        and(
          eq(userChurchScopesTable.userId, userId),
          eq(userChurchScopesTable.churchId, churchId)
        )
      );

    if (!isAdmin && scopes.length > 0) {
      await db.insert(userChurchScopesTable).values(
        scopes.map(scope => ({ userId, churchId, scope }))
      );
    }

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

    const dbUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.id, userId),
    });
    if (!dbUser) throw new Error("User not found.");

    const now = new Date();

    await db
      .update(userChurchRolesTable)
      .set({ deletedAt: now })
      .where(
        and(
          eq(userChurchRolesTable.churchId, churchId),
          eq(userChurchRolesTable.userId, userId),
          isNull(userChurchRolesTable.deletedAt),
        )
      );

    // Delete all scopes for this user in this church
    await db
      .delete(userChurchScopesTable)
      .where(
        and(
          eq(userChurchScopesTable.userId, userId),
          eq(userChurchScopesTable.churchId, churchId)
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
