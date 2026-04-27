import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { hasScope, isAdminUser } from "@/lib/utils/access-control";
import { handleRouteError } from "@/lib/utils/apiError";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { updateFileCache } from "@/lib/githubCache";
import { bumpLastCmsEditAt } from "@/lib/utils/bumpLastCmsEditAt";
import { parse, stringify } from "@/lib/serialization";

interface AssignPayload {
  series: string;
  paths: string[];
}

export interface AssignResult {
  path: string;
  status: "success" | "error";
  error?: string;
}

export async function POST(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });
    if (!hasScope(user, "collection:sermons") && !isAdminUser(user)) {
      return new Response(null, { status: 403 });
    }

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const body: AssignPayload = await request.json();
    const { series, paths } = body;

    if (!series?.trim()) {
      return Response.json({ status: "error", message: "series is required" }, { status: 400 });
    }
    if (!Array.isArray(paths) || paths.length === 0) {
      return Response.json({ status: "error", message: "paths must be a non-empty array" }, { status: 400 });
    }

    const octokit = createOctokitInstance(token);
    const author =
      user.name && user.email ? { name: user.name, email: user.email } : undefined;

    const results: AssignResult[] = [];

    // Process in batches of 5 to stay within GitHub rate limits
    const BATCH_SIZE = 5;
    for (let i = 0; i < paths.length; i += BATCH_SIZE) {
      const batch = paths.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((path) =>
          assignSeriesToFile(octokit, params.owner, params.repo, params.branch, path, series, author)
        )
      );
      for (let j = 0; j < batch.length; j++) {
        const result = batchResults[j];
        if (result.status === "fulfilled") {
          results.push({ path: batch[j], status: "success" });
          const { content: fileContent, sha, size, downloadUrl, commitSha, commitDate } = result.value;
          await updateFileCache("collection", params.owner, params.repo, params.branch, {
            type: "modify",
            path: batch[j],
            content: fileContent,
            sha,
            size,
            downloadUrl,
            commit: { sha: commitSha, timestamp: new Date(commitDate).getTime() },
          });
        } else {
          results.push({
            path: batch[j],
            status: "error",
            error: result.reason instanceof Error ? result.reason.message : "Unknown error",
          });
        }
      }
    }

    bumpLastCmsEditAt(params.owner, params.repo);

    return Response.json({
      status: "success",
      data: {
        updated: results.filter((r) => r.status === "success").length,
        results,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function assignSeriesToFile(
  octokit: ReturnType<typeof createOctokitInstance>,
  owner: string,
  repo: string,
  branch: string,
  path: string,
  series: string,
  author: { name: string; email: string } | undefined
) {
  const fileRes = await octokit.rest.repos.getContent({ owner, repo, path, ref: branch });
  if (Array.isArray(fileRes.data) || fileRes.data.type !== "file") {
    throw new Error(`${path} is not a file`);
  }

  const text = Buffer.from(fileRes.data.content, "base64").toString("utf-8");
  const parsed = parse(text, { format: "yaml-frontmatter" });
  parsed.series = series;
  const updatedContent = stringify(parsed, { format: "yaml-frontmatter" });
  const contentBase64 = Buffer.from(updatedContent).toString("base64");

  const updateRes = await octokit.rest.repos.createOrUpdateFileContents({
    owner, repo, path,
    message: `Update series for ${path.split("/").pop()} (via Cornerstone CMS)`,
    content: contentBase64,
    sha: fileRes.data.sha,
    branch,
    ...(author ? { author, committer: author } : {}),
  });

  if (!updateRes.data.content || !updateRes.data.commit) {
    throw new Error("GitHub did not return expected response");
  }

  return {
    content: updatedContent,
    sha: updateRes.data.content.sha!,
    size: updateRes.data.content.size ?? 0,
    downloadUrl: updateRes.data.content.download_url ?? undefined,
    commitSha: updateRes.data.commit.sha!,
    commitDate: updateRes.data.commit.committer?.date ?? new Date().toISOString(),
  };
}
