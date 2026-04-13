import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { ChurchPortalCard } from "@/components/home/church-portal-card";
import { getVersionStatus } from "@/lib/actions/cornerstone-update";
import { getFileWithSha } from "@/lib/github/wizard";
import { ChevronLeft } from "lucide-react";
import YAML from "yaml";

export default async function ChurchPortalPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user } = await getAuth();
  if (!user || !user.isSuperAdmin) return redirect("/");

  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, params.id),
  });

  if (!church || church.deletedAt) return notFound();

  const [versionStatus, bulletinsEnabled] = await Promise.all([
    getVersionStatus(church.id).catch(() => null),
    getFileWithSha(church.slug, "src/config/site.config.yaml")
      .then(({ content }) => {
        const cfg = YAML.parse(content) as { features?: Record<string, boolean> };
        return cfg.features?.bulletins === true;
      })
      .catch(() => false),
  ]);

  const assignment = {
    churchId: church.id,
    githubRepoName: church.githubRepoName,
    slug: church.slug,
    displayName: church.displayName,
    cfPagesUrl: church.cfPagesUrl,
    isAdmin: true,
    scopes: [] as string[],
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
      <ChurchPortalCard
        assignment={assignment}
        status={church.status}
        versionStatus={versionStatus ?? undefined}
        bulletinsEnabled={bulletinsEnabled}
        customDomain={church.customDomain}
      />
    </>
  );
}
