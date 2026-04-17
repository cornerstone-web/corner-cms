import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable, usersTable, userSiteRolesTable, userSiteScopesTable } from "@/db/schema";
import { UsersPanel } from "@/components/repo/users-panel";

export default async function UsersPage(
  props: {
    params: Promise<{ owner: string; repo: string; branch: string }>;
  }
) {
  const params = await props.params;

  const {
    owner,
    repo
  } = params;

  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  const githubRepoName = `${owner}/${repo}`;
  const site = await db.query.sitesTable.findFirst({
    where: and(
      eq(sitesTable.githubRepoName, githubRepoName),
      isNull(sitesTable.deletedAt)
    ),
  });

  if (!site) return notFound();

  // Access guard: super admin or site admin only
  const isAdmin =
    user.isSuperAdmin ||
    (user.siteAssignment?.siteId === site.id &&
      user.siteAssignment.isAdmin);

  if (!isAdmin) return redirect(`/${owner}/${repo}`);

  const users = await db
    .select({
      userId: userSiteRolesTable.userId,
      isAdmin: userSiteRolesTable.isAdmin,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(userSiteRolesTable)
    .innerJoin(usersTable, eq(userSiteRolesTable.userId, usersTable.id))
    .where(
      and(
        eq(userSiteRolesTable.siteId, site.id),
        isNull(userSiteRolesTable.deletedAt),
        isNull(usersTable.deletedAt)
      )
    );

  // Load scopes for all non-admin users
  const allScopes = await db
    .select({
      userId: userSiteScopesTable.userId,
      scope: userSiteScopesTable.scope,
    })
    .from(userSiteScopesTable)
    .where(eq(userSiteScopesTable.siteId, site.id));

  const scopesByUser = allScopes.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.userId] ??= [];
    acc[row.userId].push(row.scope);
    return acc;
  }, {});

  const usersWithScopes = users.map(u => ({
    ...u,
    scopes: scopesByUser[u.userId] ?? [],
  }));

  return <UsersPanel siteId={site.id} owner={owner} repo={repo} branch={params.branch} initialUsers={usersWithScopes} />;
}
