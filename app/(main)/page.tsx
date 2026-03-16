import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { MainRootLayout } from "./main-root-layout";
import { ChurchPortalCard } from "@/components/home/church-portal-card";
import { SuperAdminDashboard } from "@/components/home/super-admin-dashboard";
import { getVersionStatus } from "@/lib/actions/cornerstone-update";

export default async function Page() {
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  if (user.isSuperAdmin) {
    const churches = await db
      .select({
        id: churchesTable.id,
        displayName: churchesTable.displayName,
        slug: churchesTable.slug,
        githubRepoName: churchesTable.githubRepoName,
        cfPagesUrl: churchesTable.cfPagesUrl,
        customDomain: churchesTable.customDomain,
        status: churchesTable.status,
        updatedAt: churchesTable.updatedAt,
      })
      .from(churchesTable)
      .where(isNull(churchesTable.deletedAt))
      .orderBy(churchesTable.displayName);

    return (
      <MainRootLayout>
        <SuperAdminDashboard churches={churches} />
      </MainRootLayout>
    );
  }

  if (user.churchAssignment) {
    const churchId = user.churchAssignment.churchId;
    const [church, versionStatus] = await Promise.all([
      db.query.churchesTable.findFirst({
        where: eq(churchesTable.id, churchId),
        columns: { status: true },
      }),
      // Only check version for active sites — avoid noise during setup
      getVersionStatus(churchId).catch(() => null),
    ]);

    return (
      <MainRootLayout>
        <ChurchPortalCard
          assignment={user.churchAssignment}
          status={church?.status}
          versionStatus={versionStatus ?? undefined}
        />
      </MainRootLayout>
    );
  }

  // No church assigned and not super admin
  return (
    <MainRootLayout>
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="font-semibold text-lg">No site assigned</h2>
          <p className="text-muted-foreground text-sm">
            You haven&apos;t been assigned to a site yet. Contact your
            administrator to get access.
          </p>
        </div>
      </div>
    </MainRootLayout>
  );
}
