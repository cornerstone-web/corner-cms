import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable } from "@/db/schema";
import { SitePortalCard } from "@/components/home/site-portal-card";
import { getVersionStatus } from "@/lib/actions/cornerstone-update";
import { getFileWithSha } from "@/lib/github/wizard";
import { ChevronLeft } from "lucide-react";
import YAML from "yaml";

export default async function SitePortalPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user } = await getAuth();
  if (!user || !user.isSuperAdmin) return redirect("/");

  const site = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, params.id),
  });

  if (!site || site.deletedAt) return notFound();

  const [versionStatus, bulletinsEnabled] = await Promise.all([
    getVersionStatus(site.id).catch(() => null),
    getFileWithSha(site.slug, "src/config/site.config.yaml")
      .then(({ content }) => {
        const cfg = YAML.parse(content) as { features?: Record<string, boolean> };
        return cfg.features?.bulletins === true;
      })
      .catch(() => false),
  ]);

  const assignment = {
    siteId: site.id,
    githubRepoName: site.githubRepoName,
    slug: site.slug,
    displayName: site.displayName,
    cfPagesUrl: site.cfPagesUrl,
    isAdmin: true,
    scopes: [] as string[],
    siteType: site.siteType,
    status: site.status,
  };

  return (
    <>
      <div className="px-4 pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Sites
        </Link>
      </div>
      <SitePortalCard
        assignment={assignment}
        status={site.status}
        versionStatus={versionStatus ?? undefined}
        bulletinsEnabled={bulletinsEnabled}
        customDomain={site.customDomain}
      />
    </>
  );
}
