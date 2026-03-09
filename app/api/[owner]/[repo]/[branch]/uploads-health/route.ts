export const maxDuration = 30;

import { type NextRequest } from "next/server";
import { parse } from "@/lib/serialization";
import { getConfig } from "@/lib/utils/config";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { getCollectionCache, getMediaCache } from "@/lib/githubCache";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { generateListToken } from "@/lib/utils/r2-token";
import YAML from "yaml";
import { handleRouteError } from "@/lib/utils/apiError";

export interface UploadIssue {
  url: string;
  source: string;
  collectionName?: string;
  entryPath?: string;
}

interface UploadsHealthResponse {
  status: "success" | "error";
  data?: {
    brokenRefs: UploadIssue[];
    unusedUploads: string[];
    scannedAt: string;
  };
  message?: string;
}

/**
 * Recursively collect all strings that look like internal URL paths
 * (start with "/" but not "//", contain no spaces).
 */
function extractInternalLinks(
  obj: any,
  fieldPath = "",
): Array<{ url: string; path: string }> {
  if (!obj || typeof obj !== "object") return [];
  const out: Array<{ url: string; path: string }> = [];
  for (const [key, val] of Object.entries(obj)) {
    const p = fieldPath ? `${fieldPath}.${key}` : key;
    if (
      typeof val === "string" &&
      val.startsWith("/") &&
      !val.startsWith("//") &&
      !val.includes(" ")
    ) {
      out.push({ url: val, path: p });
    } else if (typeof val === "object" && val !== null) {
      out.push(...extractInternalLinks(val, p));
    }
  }
  return out;
}

/**
 * BFS helper: recursively list ALL files under a media input directory.
 * getMediaCache() only lists one level, so we walk subdirs breadth-first.
 * Returns repo-relative paths (e.g. "public/uploads/featured/hero.jpg").
 */
async function listAllMediaFiles(
  owner: string,
  repo: string,
  branch: string,
  rootInputPath: string,
  token: string,
): Promise<string[]> {
  const filePaths: string[] = [];
  const queue: string[] = [rootInputPath];

  while (queue.length > 0) {
    const currentDir = queue.shift()!;
    let entries: any[];
    try {
      entries = await getMediaCache(owner, repo, branch, currentDir, token);
    } catch {
      // Directory may not exist (e.g. repo has no uploads yet)
      continue;
    }
    for (const entry of entries) {
      if (entry.type === "file") {
        if ((entry.name as string) === ".gitkeep") continue;
        filePaths.push(entry.path as string);
      } else if (entry.type === "dir") {
        queue.push(entry.path as string);
      }
    }
  }

  return filePaths;
}

/**
 * Convert a repo-relative file path to a URL path using a media config entry.
 * e.g. "public/uploads/featured/hero.jpg" → "/uploads/featured/hero.jpg"
 * when input="public/uploads" and output="/uploads".
 */
function repoPathToUrlPath(
  repoPath: string,
  inputPath: string,
  outputPath: string,
): string {
  const relative = repoPath.slice(inputPath.length); // e.g. "/featured/hero.jpg"
  const normalizedOutput = outputPath.startsWith("/") ? outputPath : `/${outputPath}`;
  return `${normalizedOutput}${relative}`;
}

/**
 * Recursively collect all strings that start with the given URL prefix.
 * Used to find R2 absolute-URL references in content entries.
 */
function extractAbsoluteLinks(obj: any, prefix: string): string[] {
  if (!obj || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const val of Object.values(obj)) {
    if (typeof val === "string" && val.startsWith(prefix)) {
      out.push(val);
    } else if (typeof val === "object" && val !== null) {
      out.push(...extractAbsoluteLinks(val, prefix));
    }
  }
  return out;
}

/**
 * Fetch all R2 files for a category prefix from corner-media.
 * Returns an array of { key, publicUrl } pairs.
 */
async function listR2Files(
  prefix: string,
  cornerMediaUrl: string,
  r2PublicUrl: string,
  secret: string,
): Promise<Array<{ key: string; publicUrl: string; name: string }>> {
  try {
    const { token, expiry } = await generateListToken(prefix, secret);
    const url = `${cornerMediaUrl}/list?key=${encodeURIComponent(prefix)}&exp=${expiry}&token=${token}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json() as { success: boolean; files?: Array<{ key: string; name: string }> };
    return (json.files ?? []).map((f) => ({
      key: f.key,
      name: f.name,
      publicUrl: `${r2PublicUrl}/${f.key}`,
    }));
  } catch {
    return [];
  }
}

/**
 * GET /api/[owner]/[repo]/[branch]/uploads-health
 *
 * Scans all collection entries and site.config.yaml for upload references,
 * computes broken refs (referenced but missing) and unused uploads (present
 * but unreferenced), and returns both lists.
 */
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: { owner: string; repo: string; branch: string } },
): Promise<Response> {
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    const config = await getConfig(params.owner, params.repo, params.branch);
    if (!config)
      throw new Error(
        `Configuration not found for ${params.owner}/${params.repo}/${params.branch}.`,
      );

    const mediaConfigs: Array<{ input: string; output: string; name?: string }> =
      (config.object?.media ?? []).filter((m: any) => m.scan !== false);

    // Without any media config there is nothing to check
    if (mediaConfigs.length === 0) {
      return Response.json({
        status: "success",
        data: { brokenRefs: [], unusedUploads: [], scannedAt: new Date().toISOString() },
      } satisfies UploadsHealthResponse);
    }

    // --- Step 1: Collect all upload files that exist in the repo (BFS per media config) ---
    const allUploadUrlPaths = new Set<string>();
    const urlPathToRepoPath = new Map<string, string>();

    for (const media of mediaConfigs) {
      const repoPaths = await listAllMediaFiles(
        params.owner,
        params.repo,
        params.branch,
        media.input,
        token,
      );
      for (const repoPath of repoPaths) {
        const urlPath = repoPathToUrlPath(repoPath, media.input, media.output);
        allUploadUrlPaths.add(urlPath);
        urlPathToRepoPath.set(urlPath, repoPath);
      }
    }

    // Derive the set of media output prefixes (e.g. ["/uploads"])
    const mediaOutputPrefixes: string[] = mediaConfigs.map((m) =>
      m.output.startsWith("/") ? m.output : `/${m.output}`,
    );

    // --- Step 2: Scan content for upload references ---
    const referencedUploadUrls = new Set<string>();
    const brokenRefs: UploadIssue[] = [];

    const serializedFormats = [
      "yaml-frontmatter",
      "json-frontmatter",
      "toml-frontmatter",
      "yaml",
      "json",
      "toml",
    ];

    const collections: any[] =
      config.object?.content?.filter(
        (item: any) => item.type === "collection",
      ) ?? [];

    for (const schema of collections) {
      if (!schema.path || !schema.format) continue;
      if (!serializedFormats.includes(schema.format)) continue;

      let entries: any[];
      try {
        entries = await getCollectionCache(
          params.owner,
          params.repo,
          params.branch,
          schema.path,
          token,
          schema.view?.node?.filename,
        );
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.type !== "file" || !entry.content) continue;
        if (
          schema.extension &&
          !entry.path.endsWith(`.${schema.extension}`)
        )
          continue;

        let contentObject: Record<string, any>;
        try {
          contentObject = parse(entry.content, {
            format: schema.format,
            delimiters: schema.delimiters,
          });
        } catch {
          continue;
        }

        const primaryField = schema.view?.primary || "title";
        const entryTitle =
          contentObject[primaryField] ||
          entry.name.replace(/\.[^.]+$/, "");

        const links = extractInternalLinks(contentObject);
        for (const { url } of links) {
          // Only consider URLs that match a media output prefix
          if (!mediaOutputPrefixes.some((prefix) => url.startsWith(prefix))) {
            continue;
          }
          referencedUploadUrls.add(url);
          if (!allUploadUrlPaths.has(url)) {
            brokenRefs.push({
              url,
              source: `${schema.label || schema.name} → ${entryTitle}`,
              collectionName: schema.name,
              entryPath: entry.path,
            });
          }
        }
      }
    }

    // --- Step 3: Scan site.config.yaml ---
    try {
      const octokit = createOctokitInstance(token);
      const siteConfigRes = await octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: "src/config/site.config.yaml",
        ref: params.branch,
      });

      if (
        !Array.isArray(siteConfigRes.data) &&
        siteConfigRes.data.type === "file"
      ) {
        const raw = Buffer.from(siteConfigRes.data.content, "base64").toString();
        const siteConfig = YAML.parse(raw);

        const allSiteLinks = extractInternalLinks(siteConfig ?? {});
        for (const { url } of allSiteLinks) {
          if (!mediaOutputPrefixes.some((prefix) => url.startsWith(prefix))) {
            continue;
          }
          referencedUploadUrls.add(url);
          if (!allUploadUrlPaths.has(url)) {
            brokenRefs.push({ url, source: "Site Config" });
          }
        }
      }
    } catch {
      // site.config.yaml may not exist — skip silently
    }

    // --- Step 3b: Scan R2 video/audio for unused files ---
    const r2UnusedKeys: string[] = [];
    const cornerMediaUrl = process.env.CORNER_MEDIA_URL;
    const cornerMediaSecret = process.env.CORNER_MEDIA_SECRET;
    const r2PublicUrl = process.env.R2_PUBLIC_URL;

    if (cornerMediaUrl && cornerMediaSecret && r2PublicUrl) {
      for (const category of ["video", "audio"] as const) {
        const prefix = `${params.owner}/${params.repo}/${category}`;
        const r2Files = await listR2Files(prefix, cornerMediaUrl, r2PublicUrl, cornerMediaSecret);

        // Gather all R2 URLs referenced in content entries
        const r2UrlPrefix = `${r2PublicUrl}/${prefix}/`;

        const referencedR2Urls = new Set<string>();

        // Scan collection entries
        for (const schema of collections) {
          if (!schema.path || !schema.format) continue;
          if (!serializedFormats.includes(schema.format)) continue;
          let entries: any[];
          try {
            entries = await getCollectionCache(
              params.owner, params.repo, params.branch,
              schema.path, token, schema.view?.node?.filename,
            );
          } catch { continue; }
          for (const entry of entries) {
            if (entry.type !== "file" || !entry.content) continue;
            let contentObject: Record<string, any>;
            try {
              contentObject = parse(entry.content, { format: schema.format, delimiters: schema.delimiters });
            } catch { continue; }
            for (const url of extractAbsoluteLinks(contentObject, r2UrlPrefix)) {
              referencedR2Urls.add(url);
            }
          }
        }

        // Scan site.config.yaml
        try {
          const octokit = createOctokitInstance(token);
          const siteConfigRes = await octokit.rest.repos.getContent({
            owner: params.owner, repo: params.repo,
            path: "src/config/site.config.yaml", ref: params.branch,
          });
          if (!Array.isArray(siteConfigRes.data) && siteConfigRes.data.type === "file") {
            const raw = Buffer.from(siteConfigRes.data.content, "base64").toString();
            const siteConfig = YAML.parse(raw);
            for (const url of extractAbsoluteLinks(siteConfig ?? {}, r2UrlPrefix)) {
              referencedR2Urls.add(url);
            }
          }
        } catch { /* site.config.yaml may not exist */ }

        for (const file of r2Files) {
          if (!referencedR2Urls.has(file.publicUrl)) {
            r2UnusedKeys.push(file.key);
          }
        }
      }
    }

    // --- Step 4: Compute unused uploads ---
    const unusedUploads: string[] = [];
    for (const urlPath of allUploadUrlPaths) {
      if (!referencedUploadUrls.has(urlPath)) {
        unusedUploads.push(urlPathToRepoPath.get(urlPath) ?? urlPath);
      }
    }
    unusedUploads.push(...r2UnusedKeys);
    unusedUploads.sort();

    return Response.json({
      status: "success",
      data: {
        brokenRefs,
        unusedUploads,
        scannedAt: new Date().toISOString(),
      },
    } satisfies UploadsHealthResponse);
  } catch (error) {
    return handleRouteError(error);
  }
}
