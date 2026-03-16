"use server";

import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable } from "@/db/schema";
import { getAuth0ManagementToken } from "@/lib/auth0Management";
import { resolveInviteEmailStatus } from "@/lib/utils/invite";
import {
  createOrResolveAuth0User,
  generatePasswordTicket,
  sendInviteEmail,
  createOrRestoreDbUser,
  assignChurchRole,
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
    const auth0UserId = await createOrResolveAuth0User(email, name, mgmtToken);
    const resetUrl = await generatePasswordTicket(auth0UserId, mgmtToken);

    // Create DB records first — if these fail, no email is sent and nothing is orphaned
    const dbUserId = await createOrRestoreDbUser(auth0UserId, email, name);
    await assignChurchRole(dbUserId, churchId, role as "church_admin" | "editor");

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
          isNull(userChurchRolesTable.deletedAt),
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

    await db
      .update(usersTable)
      .set({ deletedAt: now })
      .where(eq(usersTable.id, userId));

    const mgmtToken = await getAuth0ManagementToken();
    const deleteRes = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(dbUser.auth0Id)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${mgmtToken}` } }
    );
    // 204 = deleted, 404 = already gone — both are fine
    if (!deleteRes.ok && deleteRes.status !== 404) {
      throw new Error(`Auth0 user deletion failed (${deleteRes.status}): ${await deleteRes.text()}`);
    }

    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Remove failed." };
  }
}
