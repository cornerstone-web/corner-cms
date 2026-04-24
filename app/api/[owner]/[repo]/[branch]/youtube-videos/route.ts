import { type NextRequest } from "next/server";
import YAML from "yaml";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { hasCollectionAccess } from "@/lib/utils/access-control";
import { handleRouteError } from "@/lib/utils/apiError";

const SITE_CONFIG_PATH = "src/config/site.config.yaml";
const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> }
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });
    if (!hasCollectionAccess(user, "sermons")) return new Response(null, { status: 403 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const octokit = createOctokitInstance(token);

    // 1. Read site config for YouTube credentials
    const configResponse = await octokit.rest.repos.getContent({
      owner: params.owner,
      repo: params.repo,
      path: SITE_CONFIG_PATH,
      ref: params.branch,
    });
    if (Array.isArray(configResponse.data) || configResponse.data.type !== "file") {
      throw new Error("Could not read site config");
    }
    const siteConfig = YAML.parse(
      Buffer.from(configResponse.data.content, "base64").toString()
    );

    const apiKey = siteConfig?.integrations?.youtube?.apiKey;
    const channelId = siteConfig?.integrations?.youtube?.channelId;

    if (!apiKey || !channelId) {
      return Response.json({ status: "unconfigured" });
    }

    // 2. Fetch existing sermon files to detect already-imported video IDs
    const existingVideoIds = await getExistingSermonVideoIds(
      octokit, params.owner, params.repo, params.branch
    );

    // 3. Fetch YouTube videos
    const livestreamsOnly = request.nextUrl.searchParams.get("livestreamsOnly") === "true";
    const videos = await fetchYouTubeVideos(apiKey, channelId, livestreamsOnly, existingVideoIds);

    return Response.json({ status: "success", data: { videos } });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Fetches all .md files in src/content/sermons and extracts YouTube video IDs
async function getExistingSermonVideoIds(
  octokit: ReturnType<typeof createOctokitInstance>,
  owner: string,
  repo: string,
  branch: string
): Promise<Set<string>> {
  const videoIds = new Set<string>();
  const YOUTUBE_ID_REGEX = /youtube\.com\/(?:watch\?v=|embed\/)([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/g;

  try {
    const dirResponse = await octokit.rest.repos.getContent({
      owner, repo, path: "src/content/sermons", ref: branch,
    });
    if (!Array.isArray(dirResponse.data)) return videoIds;

    const mdFiles = dirResponse.data.filter(
      (f) => f.type === "file" && f.name.endsWith(".md")
    );

    // Batch-fetch content in groups of 10 to avoid rate limits
    const BATCH_SIZE = 10;
    for (let i = 0; i < mdFiles.length; i += BATCH_SIZE) {
      const batch = mdFiles.slice(i, i + BATCH_SIZE);
      const contents = await Promise.allSettled(
        batch.map((f) =>
          octokit.rest.repos.getContent({ owner, repo, path: f.path, ref: branch })
        )
      );
      for (const result of contents) {
        if (result.status !== "fulfilled") continue;
        const data = result.value.data;
        if (Array.isArray(data) || data.type !== "file") continue;
        const text = Buffer.from(data.content, "base64").toString();
        let match: RegExpExecArray | null;
        while ((match = YOUTUBE_ID_REGEX.exec(text)) !== null) {
          videoIds.add(match[1] || match[2]);
        }
        YOUTUBE_ID_REGEX.lastIndex = 0;
      }
    }
  } catch {
    // If directory doesn't exist yet, return empty set
  }

  return videoIds;
}

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  isLiveRecording: boolean;
  alreadyImported: boolean;
}

async function fetchYouTubeVideos(
  apiKey: string,
  channelId: string,
  livestreamsOnly: boolean,
  existingVideoIds: Set<string>
): Promise<YouTubeVideo[]> {
  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("channelId", channelId);
  url.searchParams.set("type", "video");
  url.searchParams.set("order", "date");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("key", apiKey);
  if (livestreamsOnly) url.searchParams.set("eventType", "completed");

  const response = await fetch(url.toString());
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error?.error?.message ?? `YouTube API error: ${response.status}`
    );
  }

  const data = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any): YouTubeVideo => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description ?? "",
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
    isLiveRecording: item.snippet.liveBroadcastContent === "completed" || livestreamsOnly,
    alreadyImported: existingVideoIds.has(item.id.videoId),
  }));
}
