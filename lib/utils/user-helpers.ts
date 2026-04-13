/**
 * Shared user-management helpers used by server action files.
 * Not a "use server" file — these are plain async utilities consumed server-side.
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { usersTable, userChurchRolesTable } from "@/db/schema";

// ─── Auth0 helpers ────────────────────────────────────────────────────────────

/**
 * Create a new Auth0 user or resolve an existing one by email (on 409 conflict).
 * Sets email_verified: true so the invite ticket activates immediately.
 * Throws if the user cannot be created or resolved.
 */
export async function createOrResolveAuth0User(
  email: string,
  name: string,
  mgmtToken: string,
): Promise<string> {
  const createRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      connection: "Username-Password-Authentication",
      email,
      name,
      password: `${crypto.randomUUID()}Aa1!`,
      email_verified: true,
      blocked: false,
    }),
  });

  if (createRes.ok) {
    return ((await createRes.json()) as { user_id: string }).user_id;
  }

  const err = await createRes.json();
  if (err.statusCode === 409) {
    const searchRes = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
      { headers: { Authorization: `Bearer ${mgmtToken}` } },
    );
    if (searchRes.ok) {
      const existing = (await searchRes.json()) as { user_id?: string }[];
      const auth0UserId = existing[0]?.user_id;
      if (auth0UserId) return auth0UserId;
      // 409 but search returned no results — likely a connection mismatch (e.g. social login)
      throw new Error(`Auth0 user with email ${email} exists in another connection and cannot be resolved.`);
    }
    throw new Error(`Auth0 email lookup failed (${searchRes.status}) after 409 conflict.`);
  }

  throw new Error(`Auth0 user creation failed: ${err.message ?? createRes.status}`);
}

/**
 * Generate a 7-day password-change ticket for the given Auth0 user.
 * Returns the ticket URL. Throws on failure.
 */
export async function generatePasswordTicket(
  auth0UserId: string,
  mgmtToken: string,
): Promise<string> {
  const ticketRes = await fetch(
    `https://${process.env.AUTH0_DOMAIN}/api/v2/tickets/password-change`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${mgmtToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: auth0UserId,
        result_url: process.env.APP_BASE_URL ?? "/",
        ttl_sec: 604800, // 7 days
      }),
    },
  );
  if (!ticketRes.ok) throw new Error(`Auth0 ticket generation failed (${ticketRes.status}).`);
  const { ticket } = (await ticketRes.json()) as { ticket: string };
  return ticket;
}

/**
 * Send a branded invite email via corner-apostle.
 * Never throws — returns false if the send fails.
 */
export async function sendInviteEmail(
  to: string,
  name: string,
  siteName: string,
  resetUrl: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.CORNER_APOSTLE_URL}/send-invite`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CORNERSTONE_INTERNAL_SECRET ?? ""}`,
      },
      body: JSON.stringify({ to, name, siteName, resetUrl }),
    });
    if (!res.ok) {
      console.error("Invite email send failed (non-fatal):", await res.text().catch(() => "(no body)"));
    }
    return res.ok;
  } catch (err) {
    console.error("Invite email error (non-fatal):", err);
    return false;
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/**
 * Create or restore a DB user record.
 * Checks by auth0Id first, then falls back to email (handles re-invite after deletion,
 * where Auth0 may assign a new user_id to the same email).
 * Restores soft-deleted rows and syncs auth0Id/name/email.
 * Returns the DB user id.
 */
export async function createOrRestoreDbUser(
  auth0UserId: string,
  email: string,
  name: string,
): Promise<string> {
  let existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.auth0Id, auth0UserId),
  });
  if (!existing) {
    existing = await db.query.usersTable.findFirst({
      where: eq(usersTable.email, email),
    });
  }

  if (existing) {
    await db
      .update(usersTable)
      .set({ auth0Id: auth0UserId, email, name, deletedAt: null })
      .where(eq(usersTable.id, existing.id));
    return existing.id;
  }

  return (
    await db
      .insert(usersTable)
      .values({ auth0Id: auth0UserId, email, name })
      .returning({ id: usersTable.id })
  )[0].id;
}

/**
 * Assign (or restore) a church membership for the given user.
 * isAdmin=true makes the user a church admin; false makes them a scoped user.
 * Throws if the user already has an active role at a different church.
 * Upserts to handle re-invites (restores soft-deleted rows).
 */
export async function assignChurchMembership(
  dbUserId: string,
  churchId: string,
  isAdmin: boolean,
): Promise<void> {
  const activeElsewhere = await db.query.userChurchRolesTable.findFirst({
    where: and(
      eq(userChurchRolesTable.userId, dbUserId),
      isNull(userChurchRolesTable.deletedAt),
    ),
  });
  if (activeElsewhere && activeElsewhere.churchId !== churchId) {
    throw new Error("This user already has an active account with another site.");
  }

  const existingRole = await db.query.userChurchRolesTable.findFirst({
    where: and(
      eq(userChurchRolesTable.userId, dbUserId),
      eq(userChurchRolesTable.churchId, churchId),
    ),
  });

  if (existingRole) {
    await db
      .update(userChurchRolesTable)
      .set({ isAdmin, deletedAt: null })
      .where(eq(userChurchRolesTable.id, existingRole.id));
  } else {
    await db.insert(userChurchRolesTable).values({ userId: dbUserId, churchId, isAdmin });
  }
}
