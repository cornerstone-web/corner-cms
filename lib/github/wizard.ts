import YAML from "yaml";
import { getInstallationToken } from "@/lib/token";
import { createOctokitInstance } from "@/lib/utils/octokit";

const GITHUB_ORG = process.env.GITHUB_ORG ?? "cornerstone-web";
const CORNERSTONE_REPO = process.env.CORNERSTONE_REPO ?? "cornerstone";

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
  const token = await getInstallationToken(GITHUB_ORG, CORNERSTONE_REPO);
  const octokit = createOctokitInstance(token);

  // 1. Create the new empty repo
  await octokit.rest.repos.createInOrg({
    org: GITHUB_ORG,
    name: repoName,
    private: true,
    auto_init: false,
  });

  // 2. Get the tree of corner-template from the cornerstone monorepo
  const templatePrefix = "corner-template/";

  const { data: repoData } = await octokit.rest.repos.get({
    owner: GITHUB_ORG,
    repo: CORNERSTONE_REPO,
  });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.rest.git.getRef({
    owner: GITHUB_ORG,
    repo: CORNERSTONE_REPO,
    ref: `heads/${defaultBranch}`,
  });
  const commitSha = refData.object.sha;

  const { data: treeData } = await octokit.rest.git.getTree({
    owner: GITHUB_ORG,
    repo: CORNERSTONE_REPO,
    tree_sha: commitSha,
    recursive: "1",
  });

  // Filter to only corner-template/ files, skip .gitkeep files
  const templateFiles = (treeData.tree ?? []).filter(
    (item) =>
      item.path?.startsWith(templatePrefix) &&
      item.type === "blob" &&
      !item.path.endsWith(".gitkeep")
  );

  if (templateFiles.length === 0) {
    throw new Error("corner-template directory not found or empty in cornerstone repo");
  }

  // 3. Fetch file contents and re-create blobs in the new repo
  const fileContents: { path: string; content: string; mode: string }[] = [];
  for (const item of templateFiles) {
    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: GITHUB_ORG,
      repo: CORNERSTONE_REPO,
      path: item.path!,
      ref: commitSha,
    });
    const file = fileData as { content: string; encoding: string };
    fileContents.push({
      path: item.path!.slice(templatePrefix.length),
      content: file.content, // already base64
      mode: item.mode ?? "100644",
    });
  }

  // 4. Create blobs in the new repo
  const newTreeEntries: { path: string; mode: string; type: string; sha: string }[] = [];
  for (const file of fileContents) {
    const { data: blob } = await octokit.rest.git.createBlob({
      owner: GITHUB_ORG,
      repo: repoName,
      content: file.content,
      encoding: "base64",
    });
    newTreeEntries.push({
      path: file.path,
      mode: file.mode as "100644",
      type: "blob",
      sha: blob.sha,
    });
  }

  // 5. Create tree, commit, and set as main branch
  const { data: newTree } = await octokit.rest.git.createTree({
    owner: GITHUB_ORG,
    repo: repoName,
    tree: newTreeEntries as Parameters<typeof octokit.rest.git.createTree>[0]["tree"],
  });

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner: GITHUB_ORG,
    repo: repoName,
    message: "chore: initialize from corner-template",
    tree: newTree.sha,
    parents: [],
  });

  await octokit.rest.git.createRef({
    owner: GITHUB_ORG,
    repo: repoName,
    ref: "refs/heads/main",
    sha: newCommit.sha,
  });
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
