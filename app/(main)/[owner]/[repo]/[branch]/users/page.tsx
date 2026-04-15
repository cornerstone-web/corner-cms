import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable, userChurchScopesTable } from "@/db/schema";
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
  const church = await db.query.churchesTable.findFirst({
    where: and(
      eq(churchesTable.githubRepoName, githubRepoName),
      isNull(churchesTable.deletedAt)
    ),
  });

  if (!church) return notFound();

  // Access guard: super admin or church admin only
  const isAdmin =
    user.isSuperAdmin ||
    (user.churchAssignment?.churchId === church.id &&
      user.churchAssignment.isAdmin);

  if (!isAdmin) return redirect(`/${owner}/${repo}`);

  const users = await db
    .select({
      userId: userChurchRolesTable.userId,
      isAdmin: userChurchRolesTable.isAdmin,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(userChurchRolesTable)
    .innerJoin(usersTable, eq(userChurchRolesTable.userId, usersTable.id))
    .where(
      and(
        eq(userChurchRolesTable.churchId, church.id),
        isNull(userChurchRolesTable.deletedAt),
        isNull(usersTable.deletedAt)
      )
    );

  // Load scopes for all non-admin users
  const allScopes = await db
    .select({
      userId: userChurchScopesTable.userId,
      scope: userChurchScopesTable.scope,
    })
    .from(userChurchScopesTable)
    .where(eq(userChurchScopesTable.churchId, church.id));

  const scopesByUser = allScopes.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.userId] ??= [];
    acc[row.userId].push(row.scope);
    return acc;
  }, {});

  const usersWithScopes = users.map(u => ({
    ...u,
    scopes: scopesByUser[u.userId] ?? [],
  }));

  return <UsersPanel churchId={church.id} owner={owner} repo={repo} branch={params.branch} initialUsers={usersWithScopes} />;
}
