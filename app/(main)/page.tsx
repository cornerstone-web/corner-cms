import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { MainRootLayout } from "./main-root-layout";
import { SitePortalCard } from "@/components/home/site-portal-card";
import { SuperAdminDashboard } from "@/components/home/super-admin-dashboard";
import { getVersionStatus } from "@/lib/actions/cornerstone-update";
import { getFileWithSha } from "@/lib/github/wizard";
import YAML from "yaml";

export default async function Page() {
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  if (user.isSuperAdmin) {
    const sites = await db
      .select({
        id: sitesTable.id,
        displayName: sitesTable.displayName,
        slug: sitesTable.slug,
        githubRepoName: sitesTable.githubRepoName,
        cfPagesUrl: sitesTable.cfPagesUrl,
        customDomain: sitesTable.customDomain,
        status: sitesTable.status,
        updatedAt: sitesTable.updatedAt,
        lastCmsEditAt: sitesTable.lastCmsEditAt,
      })
      .from(sitesTable)
      .where(isNull(sitesTable.deletedAt))
      .orderBy(sitesTable.displayName);

    return (
      <MainRootLayout>
        <SuperAdminDashboard sites={sites} />
      </MainRootLayout>
    );
  }

  if (user.siteAssignment) {
    const siteId = user.siteAssignment.siteId;
    const repoName = user.siteAssignment.githubRepoName.split("/")[1];
    const [site, versionStatus, bulletinsEnabled] = await Promise.all([
      db.query.sitesTable.findFirst({
        where: eq(sitesTable.id, siteId),
        columns: { status: true, customDomain: true },
      }),
      // Only check version for active sites — avoid noise during setup
      getVersionStatus(siteId).catch(() => null),
      getFileWithSha(repoName, "src/config/site.config.yaml")
        .then(({ content }) => {
          const cfg = YAML.parse(content) as { features?: Record<string, boolean> };
          return cfg.features?.bulletins === true;
        })
        .catch(() => false),
    ]);

    return (
      <MainRootLayout>
        <SitePortalCard
          assignment={user.siteAssignment}
          status={site?.status}
          versionStatus={versionStatus ?? undefined}
          bulletinsEnabled={bulletinsEnabled}
          customDomain={site?.customDomain}
        />
      </MainRootLayout>
    );
  }

  // No site assigned and not super admin
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
