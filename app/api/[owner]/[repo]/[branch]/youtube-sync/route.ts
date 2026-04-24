/**
 * Create a sermon entry from a YouTube video.
 *
 * POST /api/[owner]/[repo]/[branch]/youtube-sync
 *
 * Body: { title, date, speaker, series, description, videoUrl, draft }
 * Returns: { status: "success", data: { path, sha } }
 * Requires authentication and collection:sermons access.
 */
import YAML from "yaml";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { hasCollectionAccess } from "@/lib/utils/access-control";
import { handleRouteError } from "@/lib/utils/apiError";
import { updateFileCache } from "@/lib/githubCache";
import { bumpLastCmsEditAt } from "@/lib/utils/bumpLastCmsEditAt";

interface SyncPayload {
  title: string;
  date: string;        // YYYY-MM-DD
  speaker: string;
  series: string;
  description: string;
  videoUrl: string;    // https://www.youtube.com/watch?v={id}
  draft: boolean;      // true = save as draft, false = publish
}

export async function POST(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });
    if (!hasCollectionAccess(user, "sermons")) return new Response(null, { status: 403 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const body: SyncPayload = await request.json();
    const { title, date, speaker, series, description, videoUrl, draft } = body;

    if (!title?.trim() || !date?.trim() || !videoUrl?.trim()) {
      return Response.json(
        { status: "error", message: "title, date, and videoUrl are required" },
        { status: 400 }
      );
    }

    if (!videoUrl.startsWith("https://www.youtube.com/watch?v=") && !videoUrl.startsWith("https://youtu.be/")) {
      return Response.json({ status: "error", message: "videoUrl must be a YouTube URL" }, { status: 400 });
    }

    const slug = slugify(title);
    const filePath = `src/content/sermons/${slug}.md`;

    const frontmatter = {
      title,
      template: "sermon",
      date,
      speaker: speaker || "",
      ...(series ? { series } : {}),
      description: description || "",
      draft,
      passwordProtected: false,
      blocks: [
        {
          type: "video-embed",
          useYoutubeLive: false,
          url: videoUrl,
          aspectRatio: "16:9",
          showTitle: true,
          title,
        },
      ],
      showDetailBar: true,
      detailBarColor: "default",
    };

    const fileContent = `---\n${YAML.stringify(frontmatter)}---\n`;
    const contentBase64 = Buffer.from(fileContent).toString("base64");

    const octokit = createOctokitInstance(token, { retry: { doNotRetry: [409] } });
    const author =
      user.name && user.email ? { name: user.name, email: user.email } : undefined;

    // Handle duplicate slugs by appending suffix
    let finalPath = filePath;
    let response;
    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const attemptPath =
          attempt === 0 ? filePath : filePath.replace(".md", `-${attempt}.md`);
        finalPath = attemptPath;
        response = await octokit.rest.repos.createOrUpdateFileContents({
          owner: params.owner,
          repo: params.repo,
          path: attemptPath,
          message: `Create ${attemptPath} (via Cornerstone CMS)`,
          content: contentBase64,
          branch: params.branch,
          ...(author ? { author, committer: author } : {}),
        });
        break;
      } catch (err: any) {
        if (err.status === 422 && attempt < 3) continue;
        throw err;
      }
    }

    if (!response?.data.content || !response?.data.commit) {
      throw new Error("Failed to create file");
    }

    await updateFileCache("collection", params.owner, params.repo, params.branch, {
      type: "add",
      path: finalPath,
      content: fileContent,
      sha: response.data.content.sha!,
    });

    bumpLastCmsEditAt(params.owner, params.repo);

    return Response.json({
      status: "success",
      data: { path: finalPath, sha: response.data.content.sha },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 80);
  return slug || `sermon-${Date.now()}`;
}
