import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable } from "@/db/schema";
import { UsersPanel } from "@/components/repo/users-panel";

export default async function UsersPage({
  params: { owner, repo },
}: {
  params: { owner: string; repo: string; branch: string };
}) {
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
      user.churchAssignment.role === "church_admin");

  if (!isAdmin) return redirect(`/${owner}/${repo}`);

  const users = await db
    .select({
      userId: userChurchRolesTable.userId,
      role: userChurchRolesTable.role,
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

  return <UsersPanel churchId={church.id} initialUsers={users} />;
}
