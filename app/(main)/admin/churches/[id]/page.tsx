import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable } from "@/db/schema";
import { ChurchManagement } from "@/components/admin/church-management";

export default async function ChurchPage({ params }: { params: { id: string } }) {
  const { user } = await getAuth();
  if (!user || !user.isSuperAdmin) return redirect("/");

  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, params.id),
  });

  if (!church || church.deletedAt) return notFound();

  // Fetch users with roles for this church
  const roleRows = await db
    .select({
      userId: userChurchRolesTable.userId,
      role: userChurchRolesTable.role,
      name: usersTable.name,
      email: usersTable.email,
      auth0Id: usersTable.auth0Id,
    })
    .from(userChurchRolesTable)
    .innerJoin(usersTable, eq(userChurchRolesTable.userId, usersTable.id))
    .where(
      and(
        eq(userChurchRolesTable.churchId, church.id),
        isNull(userChurchRolesTable.deletedAt),
        isNull(usersTable.deletedAt),
      )
    );

  return <ChurchManagement church={church} users={roleRows} />;
}
