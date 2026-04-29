import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { hasScope, isAdminUser } from "@/lib/utils/access-control";
import { handleRouteError } from "@/lib/utils/apiError";
import { getCollectionCache } from "@/lib/githubCache";
import { parse } from "@/lib/serialization";

const SERMONS_PATH = "src/content/sermons";

export interface UnassignedSermon {
  path: string;
  title: string;
  date: string;
  speaker: string;
}

export async function GET(
  _request: NextRequest,
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

    const entries = await getCollectionCache(
      params.owner, params.repo, params.branch, SERMONS_PATH, token
    );

    const sermons: UnassignedSermon[] = [];
    for (const entry of entries) {
      if (entry.type !== "file" || !entry.name.endsWith(".md") || !entry.content) continue;
      try {
        const fm = parse(entry.content, { format: "yaml-frontmatter" });
        const series = fm?.series;
        if (series && typeof series === "string" && series.trim()) continue;
        sermons.push({
          path: entry.path,
          title: typeof fm?.title === "string" ? fm.title : entry.name.replace(/\.md$/, ""),
          date: typeof fm?.date === "string" ? fm.date : "",
          speaker: typeof fm?.speaker === "string" ? fm.speaker : "",
        });
      } catch { /* skip malformed */ }
    }

    // Sort most recent first
    sermons.sort((a, b) => {
      if (a.date && b.date) return b.date.localeCompare(a.date);
      return a.title.localeCompare(b.title);
    });

    return Response.json({ status: "success", data: { sermons } });
  } catch (error) {
    return handleRouteError(error);
  }
}
