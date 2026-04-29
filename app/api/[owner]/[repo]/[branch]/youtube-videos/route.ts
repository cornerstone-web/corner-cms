import { type NextRequest } from "next/server";
import YAML from "yaml";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { hasScope, isAdminUser } from "@/lib/utils/access-control";
import { handleRouteError } from "@/lib/utils/apiError";
import { getCollectionCache } from "@/lib/githubCache";
import { getSeriesTitles } from "@/lib/utils/series";

/**
 * Fetch YouTube videos available for sermon import.
 *
 * GET /api/[owner]/[repo]/[branch]/youtube-videos
 *
 * Returns { status: "unconfigured" } if YouTube API key/channel is not set in site config.
 * Returns { status: "success", data: { videos: YouTubeVideo[] } } otherwise.
 * Requires authentication and collection:sermons access.
 */

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
    if (!hasScope(user, "collection:sermons") && !isAdminUser(user)) return new Response(null, { status: 403 });

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

    // 2. Fetch existing sermon files for already-imported video IDs, and series collection for series list
    const [{ videoIds: existingVideoIds }, series] = await Promise.all([
      getExistingSermonData(params.owner, params.repo, params.branch, token),
      getSeriesTitles(params.owner, params.repo, params.branch, token),
    ]);

    // 3. Fetch YouTube videos
    const livestreamsOnly = request.nextUrl.searchParams.get("livestreamsOnly") === "true";
    const videos = await fetchYouTubeVideos(apiKey, channelId, livestreamsOnly, existingVideoIds);

    return Response.json({ status: "success", data: { videos, series } });
  } catch (error) {
    return handleRouteError(error);
  }
}

// Scans the cached sermon collection for already-imported YouTube video IDs
async function getExistingSermonData(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<{ videoIds: Set<string> }> {
  const videoIds = new Set<string>();

  try {
    const entries = await getCollectionCache(owner, repo, branch, "src/content/sermons", token);
    for (const entry of entries) {
      if (entry.type !== "file" || !entry.name.endsWith(".md") || !entry.content) continue;
      const youtubeIdRegex = /youtube\.com\/(?:watch\?v=|embed\/)([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/g;
      let match: RegExpExecArray | null;
      while ((match = youtubeIdRegex.exec(entry.content)) !== null) {
        videoIds.add(match[1] || match[2]);
      }
    }
  } catch {
    // If collection doesn't exist yet, return empty results
  }

  return { videoIds };
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
  return (data.items ?? []).map((item: any): YouTubeVideo => ({
    id: item.id.videoId,
    title: decodeHtmlEntities(item.snippet.title),
    description: decodeHtmlEntities(item.snippet.description ?? ""),
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
    isLiveRecording: item.snippet.liveBroadcastContent === "completed" || livestreamsOnly,
    alreadyImported: existingVideoIds.has(item.id.videoId),
  }));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
