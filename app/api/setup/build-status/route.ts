import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Poll the Cloudflare Pages deployment API for the most recent deployment status.
 *
 * GET /api/setup/build-status?churchId=<uuid>
 *
 * Returns: { status: "building" | "success" | "failure"; url?: string }
 *
 * Auth: must be authenticated as church_admin for the queried church, or isSuperAdmin.
 */
export async function GET(request: Request) {
  const { user } = await getAuth();
  if (!user) return new Response(null, { status: 401 });

  const url = new URL(request.url);
  const churchId = url.searchParams.get("churchId");

  if (!churchId) {
    return Response.json({ error: "Missing churchId query param" }, { status: 400 });
  }

  // Auth guard: super admin or church_admin for the queried church
  const isAuthorized =
    user.isSuperAdmin ||
    (user.churchAssignment?.churchId === churchId &&
      user.churchAssignment?.role === "church_admin");

  if (!isAuthorized) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch church record to get CF Pages project name
  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
    columns: { cfPagesProjectName: true },
  });

  if (!church) {
    return Response.json({ error: "Church not found" }, { status: 404 });
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const projectName = church.cfPagesProjectName;

  if (!accountId || !apiToken || !projectName) {
    return Response.json({ error: "Cloudflare Pages not configured for this church" }, { status: 502 });
  }

  // Fetch the most recent deployment from CF Pages API
  const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`;

  let cfRes: Response;
  try {
    cfRes = await fetch(cfUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
  } catch {
    return Response.json({ error: "Failed to reach Cloudflare API" }, { status: 502 });
  }

  if (!cfRes.ok) {
    return Response.json({ error: "Cloudflare API returned an error" }, { status: 502 });
  }

  type CfStage = { name: string; status: string };
  type CfDeployment = { url?: string; stages: CfStage[] };
  type CfResponse = { result: CfDeployment[] };

  const cfData = (await cfRes.json()) as CfResponse;
  const deployment = cfData.result?.[0];

  if (!deployment) {
    // No deployments yet — still building
    return Response.json({ status: "building" });
  }

  const deployStage = deployment.stages?.find((s) => s.name === "deploy");

  if (deployStage?.status === "success") {
    return Response.json({ status: "success", url: deployment.url });
  }

  if (deployStage?.status === "failure") {
    return Response.json({ status: "failure" });
  }

  return Response.json({ status: "building" });
}
