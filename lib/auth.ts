/**
 * Auth helper functions using @auth0/nextjs-auth0.
 *
 * getAuth() resolves the Auth0 session → DB user → site assignment (with scopes).
 * Use this in server components / route handlers that need the authenticated user.
 */

import { cache } from "react";
import { auth0 } from "@/lib/auth0";
import { db } from "@/db";
import { usersTable, userSiteRolesTable, sitesTable, userSiteScopesTable } from "@/db/schema";
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

    // Resolve site assignment
    const roleRow = await db
      .select({
        siteId: userSiteRolesTable.siteId,
        isAdmin: userSiteRolesTable.isAdmin,
        githubRepoName: sitesTable.githubRepoName,
        slug: sitesTable.slug,
        displayName: sitesTable.displayName,
        cfPagesUrl: sitesTable.cfPagesUrl,
      })
      .from(userSiteRolesTable)
      .innerJoin(sitesTable, eq(userSiteRolesTable.siteId, sitesTable.id))
      .where(
        and(
          eq(userSiteRolesTable.userId, dbUser.id),
          isNull(userSiteRolesTable.deletedAt),
          isNull(sitesTable.deletedAt)
        )
      )
      .limit(1)
      .then(rows => rows[0] ?? null);

    let scopes: string[] = [];
    if (roleRow && !roleRow.isAdmin) {
      const scopeRows = await db
        .select({ scope: userSiteScopesTable.scope })
        .from(userSiteScopesTable)
        .where(
          and(
            eq(userSiteScopesTable.userId, dbUser.id),
            eq(userSiteScopesTable.siteId, roleRow.siteId)
          )
        );
      scopes = scopeRows.map(r => r.scope);
    }

    const user: User = {
      id: dbUser.id,
      auth0Id: dbUser.auth0Id,
      email: dbUser.email,
      name: dbUser.name,
      isSuperAdmin: dbUser.isSuperAdmin,
      siteAssignment: roleRow
        ? {
            siteId: roleRow.siteId,
            githubRepoName: roleRow.githubRepoName,
            slug: roleRow.slug,
            displayName: roleRow.displayName,
            cfPagesUrl: roleRow.cfPagesUrl,
            isAdmin: roleRow.isAdmin,
            scopes,
          }
        : null,
    };

    return { user };
  }
);
