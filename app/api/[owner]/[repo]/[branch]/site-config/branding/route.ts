import { createOctokitInstance } from "@/lib/utils/octokit";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { handleRouteError } from "@/lib/utils/apiError";
import { bumpLastCmsEditAt } from "@/lib/utils/bumpLastCmsEditAt";

const PATHS = {
  logo: "public/images/logo.png",
  favicon: "public/favicon.svg",
} as const;

type BrandingFile = keyof typeof PATHS;

const MAX_SIZES: Record<BrandingFile, number> = {
  logo: 500 * 1024,
  favicon: 50 * 1024,
};

/**
 * Read and write logo/favicon branding assets in a repository.
 *
 * GET  /api/[owner]/[repo]/[branch]/site-config/branding?file=logo|favicon
 * POST /api/[owner]/[repo]/[branch]/site-config/branding
 */

export async function GET(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const url = new URL(request.url);
    const file = url.searchParams.get("file") as BrandingFile | null;
    if (!file || !PATHS[file]) {
      return Response.json(
        { status: "error", message: 'Query param "file" must be "logo" or "favicon"' },
        { status: 400 }
      );
    }

    const octokit = createOctokitInstance(token);
    const response = await octokit.rest.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: PATHS[file],
      ref: params.branch,
    });

    if (Array.isArray(response.data) || response.data.type !== "file") {
      throw new Error("Expected a file");
    }

    return Response.json({
      status: "success",
      data: {
        sha: response.data.sha,
        downloadUrl: response.data.download_url,
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
    const { file, content, sha } = data as {
      file: BrandingFile;
      content: string;
      sha?: string;
    };

    if (!file || !PATHS[file]) {
      return Response.json(
        { status: "error", message: '"file" must be "logo" or "favicon"' },
        { status: 400 }
      );
    }

    if (!content) {
      return Response.json(
        { status: "error", message: '"content" is required' },
        { status: 400 }
      );
    }

    // Strip data URL prefix if present (e.g. "data:image/png;base64,...")
    const base64 = content.includes(",") ? content.split(",")[1] : content;

    const bytes = Buffer.from(base64, "base64");

    // Validate file size
    if (bytes.length > MAX_SIZES[file]) {
      const maxKB = MAX_SIZES[file] / 1024;
      return Response.json(
        { status: "error", message: `File must be smaller than ${maxKB}KB` },
        { status: 400 }
      );
    }

    // Validate file type by inspecting bytes
    if (file === "logo") {
      // PNG magic bytes: 0x89 0x50 0x4E 0x47
      const isPng =
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
      if (!isPng) {
        return Response.json(
          { status: "error", message: "Logo must be a PNG file" },
          { status: 400 }
        );
      }
    } else {
      // SVG is XML — must start with '<' (after optional BOM/whitespace)
      const text = bytes.toString("utf-8").trimStart();
      if (!text.startsWith("<")) {
        return Response.json(
          { status: "error", message: "Favicon must be an SVG file" },
          { status: 400 }
        );
      }
    }

    const path = PATHS[file];
    const octokit = createOctokitInstance(token, { retry: { doNotRetry: [409] } });

    const author = user.name && user.email ? { name: user.name, email: user.email } : undefined;
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: params.owner,
      repo: params.repo,
      path,
      message: `Update ${file} (via Cornerstone CMS)`,
      content: base64,
      branch: params.branch,
      sha: sha || undefined,
      ...(author ? { author, committer: author } : {}),
    });

    bumpLastCmsEditAt(params.owner, params.repo);
    return Response.json({
      status: "success",
      message: `${file === "logo" ? "Logo" : "Favicon"} updated successfully.`,
      data: {
        sha: response.data.content?.sha,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
