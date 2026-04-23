import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable, siteSubscriptionsTable, userSiteRolesTable, usersTable } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { MainRootLayout } from "./main-root-layout";
import { SitePortalCard } from "@/components/home/site-portal-card";
import { SuperAdminDashboard } from "@/components/home/super-admin-dashboard";
import { SubscriptionGate } from "@/components/home/subscription-gate";
import { NoAccessScreen } from "@/components/no-access-screen";
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
        subscriptionStatus: siteSubscriptionsTable.status,
        stripeCustomerId: siteSubscriptionsTable.stripeCustomerId,
      })
      .from(sitesTable)
      .leftJoin(siteSubscriptionsTable, eq(siteSubscriptionsTable.siteId, sitesTable.id))
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
    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.id, siteId),
      columns: { status: true, customDomain: true },
    });

    // ── Billing gate helpers ──────────────────────────────────────────────────
    async function getAdmins() {
      return db
        .select({ name: usersTable.name, email: usersTable.email })
        .from(userSiteRolesTable)
        .innerJoin(usersTable, eq(userSiteRolesTable.userId, usersTable.id))
        .where(
          and(
            eq(userSiteRolesTable.siteId, siteId),
            eq(userSiteRolesTable.isAdmin, true),
            isNull(userSiteRolesTable.deletedAt),
            isNull(usersTable.deletedAt),
          ),
        );
    }

    // ── Paused: subscription lapsed on an active site ─────────────────────────
    if (site?.status === "paused") {
      const admins = await getAdmins();

      if (user.siteAssignment.isAdmin) {
        return (
          <MainRootLayout>
            <SubscriptionGate
              siteId={siteId}
              siteName={user.siteAssignment.displayName}
              admins={admins}
              variant="subscription-lapsed"
              canManageBilling={true}
            />
          </MainRootLayout>
        );
      }

      return (
        <MainRootLayout>
          <NoAccessScreen
            title="Site access paused"
            message="Access to your site is currently paused. Please contact an admin below."
            admins={admins}
          />
        </MainRootLayout>
      );
    }

    // ── Provisioning: site not yet launched ───────────────────────────────────
    if (site?.status === "provisioning") {
      const sub = await db.query.siteSubscriptionsTable.findFirst({
        where: eq(siteSubscriptionsTable.siteId, siteId),
        columns: { status: true },
      });

      const hasPaid = sub?.status === "active" || sub?.status === "trialing";

      if (!hasPaid) {
        const admins = await getAdmins();
        return (
          <MainRootLayout>
            <SubscriptionGate
              siteId={siteId}
              siteName={user.siteAssignment.displayName}
              admins={admins}
              variant="payment-required"
              canManageBilling={user.siteAssignment.isAdmin}
            />
          </MainRootLayout>
        );
      }

      // Paid — proceed to the wizard
      return redirect("/setup");
    }

    // ── Active: normal CMS access ─────────────────────────────────────────────
    const [versionStatus, bulletinsEnabled] = await Promise.all([
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
