import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable, usersTable, userSiteRolesTable } from "@/db/schema";
import { SiteManagement } from "@/components/admin/site-management";

export default async function SitePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user } = await getAuth();
  if (!user || !user.isSuperAdmin) return redirect("/");

  const site = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, params.id),
  });

  if (!site || site.deletedAt) return notFound();

  // Fetch users with roles for this site
  const roleRows = await db
    .select({
      userId: userSiteRolesTable.userId,
      isAdmin: userSiteRolesTable.isAdmin,
      name: usersTable.name,
      email: usersTable.email,
      auth0Id: usersTable.auth0Id,
    })
    .from(userSiteRolesTable)
    .innerJoin(usersTable, eq(userSiteRolesTable.userId, usersTable.id))
    .where(
      and(
        eq(userSiteRolesTable.siteId, site.id),
        isNull(userSiteRolesTable.deletedAt),
        isNull(usersTable.deletedAt),
      )
    );

  return <SiteManagement site={site} users={roleRows} />;
}
