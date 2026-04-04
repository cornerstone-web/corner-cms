import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Poll the Cloudflare Pages deployment API for the most recent deployment status.
 *
 * GET /api/setup/build-status?churchId=<uuid>
 * GET /api/setup/build-status?repo=owner/repo
 *
 * Returns: { status: "building" | "success" | "failure"; url?: string; consecutiveFailures?: number }
 *
 * Auth: must be authenticated as any role for the queried church, or isSuperAdmin.
 */

type CfStage = { name: string; status: string };
type CfDeployment = { id?: string; url?: string; stages?: CfStage[]; latest_stage?: { status: string } };
type CfResponse = { result: CfDeployment[] };

export async function GET(request: Request) {
  const { user } = await getAuth();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(request.url);
  const churchId = url.searchParams.get("churchId");
  const repo = url.searchParams.get("repo"); // "owner/repo" alternative

  if (!churchId && !repo) {
    return Response.json({ error: "Missing churchId or repo query param" }, { status: 400 });
  }

  let church: { cfPagesProjectName: string | null; cfPagesUrl: string | null } | undefined;

  if (churchId) {
    // Auth guard: super admin or any role assigned to the queried church
    const isAuthorized =
      user.isSuperAdmin ||
      user.churchAssignment?.churchId === churchId;
    if (!isAuthorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.id, churchId),
      columns: { cfPagesProjectName: true, cfPagesUrl: true },
    });
  } else {
    // Auth guard: super admin or user whose church matches the repo
    const isAuthorized =
      user.isSuperAdmin ||
      user.churchAssignment?.githubRepoName === repo;
    if (!isAuthorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.githubRepoName, repo!),
      columns: { cfPagesProjectName: true, cfPagesUrl: true },
    });
  }

  if (!church) {
    return Response.json({ error: "Church not found" }, { status: 404 });
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const projectName = church.cfPagesProjectName;

  if (!accountId || !apiToken || !projectName) {
    return Response.json({ error: "Cloudflare Pages not configured for this church" }, { status: 502 });
  }

  // Fetch recent deployments — enough to count a consecutive failure streak (up to 5)
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=5`;

  let cfRes: Response;
  try {
    cfRes = await fetch(cfUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return Response.json({ error: "Failed to reach Cloudflare API" }, { status: 502 });
  }

  if (!cfRes.ok) {
    return Response.json({ error: "Cloudflare API returned an error" }, { status: 502 });
  }

  const cfData = (await cfRes.json()) as CfResponse;
  const deployments = cfData.result ?? [];
  const deployment = deployments[0];

  if (!deployment) {
    // No deployments yet — still building
    return Response.json({ status: "building" });
  }

  const latestStatus = deployment.latest_stage?.status;

  if (latestStatus === "success") {
    return Response.json({ status: "success", url: church.cfPagesUrl ?? deployment.url });
  }

  if (latestStatus === "failure") {
    // Count consecutive failures from most recent backwards
    let consecutiveFailures = 0;
    for (const d of deployments) {
      if (d.latest_stage?.status === "failure") {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    return Response.json({ status: "failure", consecutiveFailures });
  }

  return Response.json({ status: "building" });
}
