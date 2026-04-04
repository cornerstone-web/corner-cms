import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Retries the most recent Cloudflare Pages deployment for a church.
 *
 * POST /api/setup/retry-build
 * Body: { churchId: string } | { repo: "owner/repo" }
 *
 * Auth: super admin or church_admin for the queried church.
 */

type CfDeployment = { id?: string; latest_stage?: { status: string } };
type CfResponse = { result: CfDeployment[] };

export async function POST(request: Request) {
  const { user } = await getAuth();
  if (!user) return new Response(null, { status: 401 });

  let body: { churchId?: string; repo?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { churchId, repo } = body;

  if (!churchId && !repo) {
    return Response.json({ error: "Missing churchId or repo" }, { status: 400 });
  }

  let church: { cfPagesProjectName: string | null } | undefined;

  if (churchId) {
    const isAuthorized =
      user.isSuperAdmin ||
      (user.churchAssignment?.churchId === churchId &&
        user.churchAssignment?.role === "church_admin");
    if (!isAuthorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.id, churchId),
      columns: { cfPagesProjectName: true },
    });
  } else {
    const isAuthorized =
      user.isSuperAdmin || user.churchAssignment?.githubRepoName === repo;
    if (!isAuthorized) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.githubRepoName, repo!),
      columns: { cfPagesProjectName: true },
    });
  }

  if (!church) {
    return Response.json({ error: "Church not found" }, { status: 404 });
  }

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const projectName = church.cfPagesProjectName;

  if (!accountId || !apiToken || !projectName) {
    return Response.json(
      { error: "Cloudflare Pages not configured for this church" },
      { status: 502 },
    );
  }

  // Fetch the most recent deployment to get its ID
  const listUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=1`;
  let listRes: Response;
  try {
    listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return Response.json({ error: "Failed to reach Cloudflare API" }, { status: 502 });
  }

  if (!listRes.ok) {
    return Response.json({ error: "Cloudflare API returned an error" }, { status: 502 });
  }

  const listData = (await listRes.json()) as CfResponse;
  const deploymentId = listData.result?.[0]?.id;

  if (!deploymentId) {
    return Response.json({ error: "No deployment found to retry" }, { status: 404 });
  }

  // Retry the deployment
  const retryUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments/${deploymentId}/retry`;
  let retryRes: Response;
  try {
    retryRes = await fetch(retryUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return Response.json({ error: "Failed to reach Cloudflare API" }, { status: 502 });
  }

  if (!retryRes.ok) {
    return Response.json({ error: "Cloudflare retry API returned an error" }, { status: 502 });
  }

  return Response.json({ ok: true });
}
