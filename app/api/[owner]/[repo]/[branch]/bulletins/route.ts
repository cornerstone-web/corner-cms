import { getAuth } from "@/lib/auth";
import { commitBinaryFile, deleteRepoFile, tryGetSha } from "@/lib/github/wizard";
import { handleRouteError } from "@/lib/utils/apiError";

const BULLETIN_DIR = "public/bulletins";
const MAX_BULLETINS = 52;

/**
 * POST /api/[owner]/[repo]/[branch]/bulletins
 *
 * Uploads a PDF bulletin to the repo. Optionally deletes the oldest bulletin
 * when the 52-file limit is reached.
 *
 * Body: { date: string, pdfBase64: string, deleteOldestName?: string }
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> },
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    // Access check: super admins can upload to any repo; others must own it
    if (!user.isSuperAdmin) {
      if (!user.churchAssignment) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
      const assignedRepo = user.churchAssignment.githubRepoName.split("/")[1];
      if (assignedRepo !== params.repo) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
    }

    const body = await request.json();
    const { date, pdfBase64, deleteOldestName } = body as {
      date: string;
      pdfBase64: string;
      deleteOldestName?: string;
    };

    if (!date || typeof date !== "string") {
      return new Response(JSON.stringify({ error: '"date" is required.' }), { status: 400 });
    }
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return new Response(JSON.stringify({ error: '"pdfBase64" is required.' }), { status: 400 });
    }

    if (deleteOldestName) {
      const oldestPath = `${BULLETIN_DIR}/${deleteOldestName}`;
      const sha = await tryGetSha(params.repo, oldestPath);
      if (sha) {
        await deleteRepoFile(
          params.repo,
          oldestPath,
          sha,
          "bulletin: remove oldest (52-file limit)",
        );
      }
    }

    const targetPath = `${BULLETIN_DIR}/${date}.pdf`;
    const existingSha = await tryGetSha(params.repo, targetPath);
    await commitBinaryFile(params.repo, targetPath, pdfBase64, existingSha, `bulletin: upload ${date}`);

    return Response.json({ status: "success" });
  } catch (error) {
    return handleRouteError(error);
  }
}
