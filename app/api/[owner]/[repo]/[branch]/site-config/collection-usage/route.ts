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
function extractBlocks(
  blocks: Array<Record<string, any>>
): Array<Record<string, any>> {
  const result: Array<Record<string, any>> = [];
  for (const block of blocks) {
    if (block.type) result.push(block);
    if (block.type === "container" && block.columns) {
      for (const col of block.columns) {
        if (col.blocks) {
          result.push(...extractBlocks(col.blocks));
        }
      }
    }
  }
  return result;
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
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

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
          // Use the blob SHA already available from the tree response to avoid
          // an extra path-resolution step that getContent performs.
          const { data } = await octokit.rest.git.getBlob({
            owner: params.owner,
            repo: params.repo,
            file_sha: file.sha!,
          });

          const content = Buffer.from(data.content, "base64").toString();

          // Extract YAML frontmatter between --- delimiters
          const match = content.match(/^---\n([\s\S]*?)\n---/);
          if (!match) return;

          const frontmatter = YAML.parse(match[1]);
          if (!frontmatter?.blocks || !Array.isArray(frontmatter.blocks))
            return;

          const pageBlocks = extractBlocks(frontmatter.blocks);
          const pageName = file.path!.replace("src/content/pages/", "");
          const pageTitle = frontmatter.title || pageName;

          for (const block of pageBlocks) {
            const collections = blockCollectionMap[block.type];
            if (!collections) continue;

            // Block explicitly opts out of using a collection source
            if (block.useCollectionSource === false) continue;

            for (const col of collections) {
              usage[col].push({
                page: pageName,
                title: pageTitle,
                blockType: block.type,
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
