import { createOctokitInstance } from "@/lib/utils/octokit";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import YAML from "yaml";

/**
 * Block type → collections mapping.
 * Mirrors template-repo/src/utils/block-collections.ts
 */
const blockCollectionMap: Record<string, string[]> = {
  "sermon-grid": ["sermons", "series"],
  "event-list": ["events"],
  "article-grid": ["articles"],
  "ministry-links": ["ministries"],
  "team-grid": ["staff"],
  "series-grid": ["series"],
};

/** All toggleable collection names. */
const allCollections = [
  "articles",
  "events",
  "ministries",
  "series",
  "sermons",
  "staff",
];

interface BlockUsage {
  page: string;
  title: string;
  blockType: string;
}

/**
 * Recursively extract block types from a blocks array,
 * including blocks nested inside container columns.
 */
function extractBlockTypes(
  blocks: Array<{ type?: string; columns?: Array<{ blocks?: Array<any> }> }>
): string[] {
  const types: string[] = [];
  for (const block of blocks) {
    if (block.type) types.push(block.type);
    if (block.type === "container" && block.columns) {
      for (const col of block.columns) {
        if (col.blocks) {
          types.push(...extractBlockTypes(col.blocks));
        }
      }
    }
  }
  return types;
}

/**
 * GET /api/[owner]/[repo]/[branch]/site-config/collection-usage
 *
 * Scans all page content files in the repo to find which blocks
 * reference each toggleable collection.
 */
export async function GET(
  _request: Request,
  { params }: { params: { owner: string; repo: string; branch: string } }
) {
  try {
    const { user, session } = await getAuth();
    if (!session) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const octokit = createOctokitInstance(token);

    // 1. Get the repo tree to find all page files
    const { data: refData } = await octokit.rest.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${params.branch}`,
    });

    const { data: tree } = await octokit.rest.git.getTree({
      owner: params.owner,
      repo: params.repo,
      tree_sha: refData.object.sha,
      recursive: "1",
    });

    const pageFiles = tree.tree.filter(
      (item) =>
        item.path?.startsWith("src/content/pages/") &&
        item.path.endsWith(".md") &&
        item.type === "blob"
    );

    // 2. Fetch each page file and parse frontmatter
    const usage: Record<string, BlockUsage[]> = {};
    for (const col of allCollections) {
      usage[col] = [];
    }

    await Promise.all(
      pageFiles.map(async (file) => {
        try {
          const { data } = await octokit.rest.repos.getContent({
            owner: params.owner,
            repo: params.repo,
            path: file.path!,
            ref: params.branch,
          });

          if (Array.isArray(data) || data.type !== "file") return;

          const content = Buffer.from(data.content, "base64").toString();

          // Extract YAML frontmatter between --- delimiters
          const match = content.match(/^---\n([\s\S]*?)\n---/);
          if (!match) return;

          const frontmatter = YAML.parse(match[1]);
          if (!frontmatter?.blocks || !Array.isArray(frontmatter.blocks))
            return;

          const blockTypes = extractBlockTypes(frontmatter.blocks);
          const pageName = file.path!.replace("src/content/pages/", "");
          const pageTitle = frontmatter.title || pageName;

          for (const blockType of blockTypes) {
            const collections = blockCollectionMap[blockType];
            if (!collections) continue;

            for (const col of collections) {
              usage[col].push({
                page: pageName,
                title: pageTitle,
                blockType,
              });
            }
          }
        } catch {
          // Skip files that can't be read/parsed
        }
      })
    );

    return Response.json({
      status: "success",
      data: usage,
    });
  } catch (error: any) {
    console.error(error);
    return Response.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}
