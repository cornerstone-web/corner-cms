import YAML from "yaml";
import { getInstallationToken } from "@/lib/token";
import { createOctokitInstance } from "@/lib/utils/octokit";

const GITHUB_ORG = process.env.GITHUB_ORG ?? "cornerstone-web";
const CORNER_TEMPLATE_OWNER = process.env.CORNER_TEMPLATE_OWNER ?? "cornerstone-web";
const CORNER_TEMPLATE_REPO = process.env.CORNER_TEMPLATE_REPO ?? "corner-template";

// ─── Pure utilities ───────────────────────────────────────────────────────────

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function yamlMerge(baseYaml: string, updates: Record<string, unknown>): string {
  const base = (YAML.parse(baseYaml) ?? {}) as Record<string, unknown>;
  const merged = deepMerge(base, updates);
  return YAML.stringify(merged, { lineWidth: 0 });
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (isPlainObject(sv) && isPlainObject(tv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ─── GitHub API operations ────────────────────────────────────────────────────

export async function createRepoFromTemplate(repoName: string): Promise<void> {
  const token = await getInstallationToken(GITHUB_ORG, CORNER_TEMPLATE_REPO);
  const octokit = createOctokitInstance(token);

  await octokit.rest.repos.createUsingTemplate({
    template_owner: CORNER_TEMPLATE_OWNER,
    template_repo: CORNER_TEMPLATE_REPO,
    owner: GITHUB_ORG,
    name: repoName,
    private: true,
    include_all_branches: false,
  });

  // Brief wait for GitHub to finish initializing the repo from the template
  await new Promise((r) => setTimeout(r, 3000));
}

export async function getFileWithSha(
  repoName: string,
  path: string,
): Promise<{ content: string; sha: string }> {
  const token = await getInstallationToken(GITHUB_ORG, repoName);
  const octokit = createOctokitInstance(token);
  const res = await octokit.rest.repos.getContent({
    owner: GITHUB_ORG,
    repo: repoName,
    path,
  });
  const file = res.data as { content: string; sha: string };
  return {
    content: Buffer.from(file.content, "base64").toString("utf-8"),
    sha: file.sha,
  };
}

export async function commitFile(
  repoName: string,
  path: string,
  content: string,
  sha: string | undefined,
  message: string,
): Promise<void> {
  const token = await getInstallationToken(GITHUB_ORG, repoName);
  const octokit = createOctokitInstance(token);
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_ORG,
    repo: repoName,
    path,
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
    ...(sha ? { sha } : {}),
  });
}

export async function commitBinaryFile(
  repoName: string,
  path: string,
  base64Content: string,
  sha: string | undefined,
  message: string,
): Promise<void> {
  const token = await getInstallationToken(GITHUB_ORG, repoName);
  const octokit = createOctokitInstance(token);
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_ORG,
    repo: repoName,
    path,
    message,
    content: base64Content,
    ...(sha ? { sha } : {}),
  });
}

export async function updateSiteConfig(
  repoName: string,
  updates: Record<string, unknown>,
  commitMessage: string,
): Promise<void> {
  const configPath = "src/config/site.config.yaml";
  let sha: string | undefined;
  let currentYaml = "";
  try {
    const existing = await getFileWithSha(repoName, configPath);
    currentYaml = existing.content;
    sha = existing.sha;
  } catch {
    // File doesn't exist yet — start fresh
  }
  const updatedYaml = yamlMerge(currentYaml, updates);
  await commitFile(repoName, configPath, updatedYaml, sha, commitMessage);
}

export async function getFileDownloadUrl(
  repoName: string,
  path: string,
): Promise<string | null> {
  try {
    const token = await getInstallationToken(GITHUB_ORG, repoName);
    const octokit = createOctokitInstance(token);
    const res = await octokit.rest.repos.getContent({
      owner: GITHUB_ORG,
      repo: repoName,
      path,
    });
    const file = res.data as { download_url?: string };
    return file.download_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Lists a directory and returns parsed YAML frontmatter from the first .md file found.
 * Returns null if the directory is empty or an error occurs.
 */
export async function getFirstFileFrontmatter(
  repoName: string,
  dirPath: string,
): Promise<Record<string, unknown> | null> {
  try {
    const token = await getInstallationToken(GITHUB_ORG, repoName);
    const octokit = createOctokitInstance(token);
    const res = await octokit.rest.repos.getContent({ owner: GITHUB_ORG, repo: repoName, path: dirPath });
    const items = res.data as { name: string; type: string }[];
    const mdFile = items.find((item) => item.type === "file" && item.name.endsWith(".md"));
    if (!mdFile) return null;
    const { content } = await getFileWithSha(repoName, `${dirPath}/${mdFile.name}`);
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return YAML.parse(match[1]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Lists a directory and returns parsed YAML frontmatter from ALL .md files found.
 * Returns an empty array if the directory is empty or an error occurs.
 */
export async function getAllFilesFrontmatter(
  repoName: string,
  dirPath: string,
): Promise<Record<string, unknown>[]> {
  try {
    const token = await getInstallationToken(GITHUB_ORG, repoName);
    const octokit = createOctokitInstance(token);
    const res = await octokit.rest.repos.getContent({ owner: GITHUB_ORG, repo: repoName, path: dirPath });
    const items = res.data as { name: string; type: string }[];
    const mdFiles = items.filter((item) => item.type === "file" && item.name.endsWith(".md"));
    const results = await Promise.all(
      mdFiles.map(async (file) => {
        const { content } = await getFileWithSha(repoName, `${dirPath}/${file.name}`);
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return null;
        return YAML.parse(match[1]) as Record<string, unknown>;
      }),
    );
    return results.filter((r): r is Record<string, unknown> => r !== null);
  } catch {
    return [];
  }
}

/**
 * Lists a directory and returns { name, url } for all image files found.
 * Returns an empty array if the directory is empty or an error occurs.
 */
export async function getDirectoryImageUrls(
  repoName: string,
  dirPath: string,
): Promise<{ name: string; url: string }[]> {
  try {
    const token = await getInstallationToken(GITHUB_ORG, repoName);
    const octokit = createOctokitInstance(token);
    const res = await octokit.rest.repos.getContent({ owner: GITHUB_ORG, repo: repoName, path: dirPath });
    const items = res.data as { name: string; type: string; download_url?: string }[];
    const imageExts = /\.(jpe?g|png|gif|webp|svg|avif)$/i;
    return items
      .filter((item) => item.type === "file" && imageExts.test(item.name) && item.download_url)
      .map((item) => ({ name: item.name, url: item.download_url! }));
  } catch {
    return [];
  }
}

export async function tryGetSha(
  repoName: string,
  path: string,
): Promise<string | undefined> {
  try {
    const { sha } = await getFileWithSha(repoName, path);
    return sha;
  } catch {
    return undefined;
  }
}
