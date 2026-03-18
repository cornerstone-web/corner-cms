import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { MainRootLayout } from "@/app/(main)/main-root-layout";
import { ChurchPortalCard } from "@/components/home/church-portal-card";
import { getVersionStatus } from "@/lib/actions/cornerstone-update";
import { ChevronLeft } from "lucide-react";

export default async function ChurchPortalPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user } = await getAuth();
  if (!user || !user.isSuperAdmin) return redirect("/");

  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, params.id),
  });

  if (!church || church.deletedAt) return notFound();

  const versionStatus = await getVersionStatus(church.id).catch(() => null);

  const assignment = {
    churchId: church.id,
    githubRepoName: church.githubRepoName,
    slug: church.slug,
    displayName: church.displayName,
    cfPagesUrl: church.cfPagesUrl,
    role: "church_admin" as const,
  };

  return (
    <MainRootLayout>
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
      />
    </MainRootLayout>
  );
}
