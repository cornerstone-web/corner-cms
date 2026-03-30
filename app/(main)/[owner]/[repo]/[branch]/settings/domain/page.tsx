import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { DomainSettings } from "@/components/settings/DomainSettings";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

export default async function DomainPage(
  props: {
    params: Promise<{ owner: string; repo: string; branch: string }>;
  }
) {
  const params = await props.params;
  const { owner, repo } = params;

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

  // Fetch live domain status
  let rootStatus: string | null = null;
  let wwwStatus: string | null = null;

  if (
    church.customDomain &&
    church.cfPagesProjectName &&
    process.env.CF_ACCOUNT_ID &&
    process.env.CF_API_TOKEN
  ) {
    const cfRes = await fetch(
      `${CF_API_BASE}/accounts/${process.env.CF_ACCOUNT_ID}/pages/projects/${church.cfPagesProjectName}/domains`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
        },
        next: { revalidate: 60 },
      }
    ).catch(() => null);

    if (cfRes?.ok) {
      const cfData = await cfRes.json();
      const domains: Array<{ name: string; status: string }> = cfData.result ?? [];
      rootStatus = domains.find(d => d.name === church.customDomain)?.status ?? null;
      wwwStatus = domains.find(d => d.name === `www.${church.customDomain}`)?.status ?? null;
    }
  }

  return (
    <DomainSettings
      initialDomain={church.customDomain}
      cfPagesProjectName={church.cfPagesProjectName}
      rootStatus={rootStatus}
      wwwStatus={wwwStatus}
    />
  );
}
