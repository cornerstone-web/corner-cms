/**
 * Auth helper functions using @auth0/nextjs-auth0.
 *
 * getAuth() resolves the Auth0 session → DB user → church assignment.
 * Use this in server components / route handlers that need the authenticated user.
 */

import { cache } from "react";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { usersTable, userChurchRolesTable, churchesTable } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { User } from "@/types/user";

export const getAuth = cache(
  async (): Promise<{ user: User } | { user: null }> => {
    const session = await auth0.getSession();
    if (!session?.user?.sub) return { user: null };

    const auth0Id = session.user.sub as string;

    const dbUser = await db.query.usersTable.findFirst({
      where: and(
        eq(usersTable.auth0Id, auth0Id),
        isNull(usersTable.deletedAt)
      ),
    });

    if (!dbUser) return { user: null };

    // Resolve church assignment (one church per user for MVP)
    const roleRow = await db
      .select({
        churchId: userChurchRolesTable.churchId,
        role: userChurchRolesTable.role,
        githubRepoName: churchesTable.githubRepoName,
        slug: churchesTable.slug,
        displayName: churchesTable.displayName,
        cfPagesUrl: churchesTable.cfPagesUrl,
      })
      .from(userChurchRolesTable)
      .innerJoin(churchesTable, eq(userChurchRolesTable.churchId, churchesTable.id))
      .where(
        and(
          eq(userChurchRolesTable.userId, dbUser.id),
          isNull(userChurchRolesTable.deletedAt),
          isNull(churchesTable.deletedAt)
        )
      )
      .limit(1)
      .then(rows => rows[0] ?? null);

    const user: User = {
      id: dbUser.id,
      auth0Id: dbUser.auth0Id,
      email: dbUser.email,
      name: dbUser.name,
      isSuperAdmin: dbUser.isSuperAdmin,
      churchAssignment: roleRow
        ? {
            churchId: roleRow.churchId,
            githubRepoName: roleRow.githubRepoName,
            slug: roleRow.slug,
            displayName: roleRow.displayName,
            cfPagesUrl: roleRow.cfPagesUrl,
            role: roleRow.role,
          }
        : null,
    };

    return { user };
  }
);
