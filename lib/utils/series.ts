import { getCollectionCache } from "@/lib/githubCache";
import { parse } from "@/lib/serialization";

const SERIES_PATH = "src/content/series";

export async function getSeriesTitles(
  owner: string,
  repo: string,
  branch: string,
  token: string
): Promise<string[]> {
  try {
    const entries = await getCollectionCache(owner, repo, branch, SERIES_PATH, token);
    const titles: string[] = [];
    for (const entry of entries) {
      if (entry.type !== "file" || !entry.content) continue;
      try {
        const fm = parse(entry.content, { format: "yaml-frontmatter" });
        if (typeof fm?.title === "string" && fm.title.trim()) {
          titles.push(fm.title.trim());
        }
      } catch { /* skip malformed */ }
    }
    return titles.sort();
  } catch {
    return [];
  }
}
