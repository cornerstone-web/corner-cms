import { createOctokitInstance } from "@/lib/utils/octokit";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import YAML from "yaml";
import { siteConfigSchema } from "@/components/site-config/schema";
import { handleRouteError } from "@/lib/utils/apiError";

const SITE_CONFIG_PATH = "src/config/site.config.yaml";

/**
 * Read and write site.config.yaml in a repository.
 *
 * GET  /api/[owner]/[repo]/[branch]/site-config
 * POST /api/[owner]/[repo]/[branch]/site-config
 */

export async function GET(
  _request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: SITE_CONFIG_PATH,
      ref: params.branch,
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new Error("Expected a file");
    }

    const content = Buffer.from(response.data.content, "base64").toString();
    const parsed = YAML.parse(content);
    const config = parsed;

    return Response.json({
      status: "success",
      data: {
        sha: response.data.sha,
        config,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const data = await request.json();
    const { config: rawConfig, sha } = data;

    if (!rawConfig) throw new Error("config is required");
    if (!sha) throw new Error("sha is required");

    const parsed = siteConfigSchema.safeParse(rawConfig);
    if (!parsed.success) {
      const message = parsed.error.errors[0]?.message ?? "Invalid config";
      return Response.json({ status: "error", message }, { status: 400 });
    }
    const config = parsed.data;

    const yamlContent = YAML.stringify(config);
    const contentBase64 = Buffer.from(yamlContent).toString("base64");

    const octokit = createOctokitInstance(token, {
      retry: { doNotRetry: [409] },
    });

    const author = user.name && user.email ? { name: user.name, email: user.email } : undefined;
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: params.owner,
      repo: params.repo,
      path: SITE_CONFIG_PATH,
      message: `Update site config (via Cornerstone CMS)`,
      content: contentBase64,
      branch: params.branch,
      sha,
      ...(author ? { author, committer: author } : {}),
    });

    return Response.json({
      status: "success",
      message: "Site config saved successfully.",
      data: {
        sha: response.data.content?.sha,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
