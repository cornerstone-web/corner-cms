export const maxDuration = 30;

import { type NextRequest } from "next/server";
import { parse } from "@/lib/serialization";
import { getConfig } from "@/lib/utils/config";
import { getAuth } from "@/lib/auth";
import { getToken } from "@/lib/token";
import { getCollectionCache, checkRepoAccess } from "@/lib/githubCache";
import { createOctokitInstance } from "@/lib/utils/octokit";
import YAML from "yaml";

export interface BrokenLink {
  url: string;
  source: string;
  collectionName?: string;
  entryPath?: string;
}

interface BrokenLinksResponse {
  status: "success" | "error";
  data?: {
    brokenLinks: BrokenLink[];
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
 * GET /api/[owner]/[repo]/[branch]/broken-links
 *
 * Scans all collection entries and site.config.yaml for internal links
 * that are not present in the site manifest, indicating broken links.
 * Requires previewUrl to be configured in .pages.yml.
 */
export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: { owner: string; repo: string; branch: string } },
): Promise<Response> {
  try {
    const { user, session } = await getAuth();
    if (!session) return new Response(null, { status: 401 });

    const token = await getToken(user, params.owner, params.repo);
    if (!token) throw new Error("Token not found");

    if (user.githubId) {
      const hasAccess = await checkRepoAccess(
        token,
        params.owner,
        params.repo,
        user.githubId,
      );
      if (!hasAccess)
        throw new Error(
          `No access to repository ${params.owner}/${params.repo}.`,
        );
    }

    const config = await getConfig(params.owner, params.repo, params.branch);
    if (!config)
      throw new Error(
        `Configuration not found for ${params.owner}/${params.repo}/${params.branch}.`,
      );

    // Derive media output prefixes (e.g. ["/uploads"]) to exclude from broken-link checks
    const mediaOutputPrefixes: string[] = (config.object?.media ?? []).map(
      (m: any) => ((m.output as string).startsWith("/") ? m.output : `/${m.output}`),
    );

    const previewUrl = config.object?.previewUrl;

    // Without previewUrl there's no manifest to validate against
    if (!previewUrl) {
      return Response.json({
        status: "success",
        data: { brokenLinks: [], scannedAt: new Date().toISOString() },
      } satisfies BrokenLinksResponse);
    }

    // Fetch the site manifest to get the full set of valid internal URLs
    let validUrls: Set<string>;
    try {
      const manifestRes = await fetch(`${previewUrl}/site-manifest.json`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!manifestRes.ok) throw new Error("Manifest fetch failed");
      const manifest = await manifestRes.json();
      validUrls = new Set<string>(
        Object.values(manifest.collections as Record<string, Array<{ url: string }>>)
          .flat()
          .map((l) => l.url),
      );
    } catch {
      // Site not reachable — skip scan rather than surface an error
      return Response.json({
        status: "success",
        data: { brokenLinks: [], scannedAt: new Date().toISOString() },
      } satisfies BrokenLinksResponse);
    }

    const brokenLinks: BrokenLink[] = [];
    const serializedFormats = [
      "yaml-frontmatter",
      "json-frontmatter",
      "toml-frontmatter",
      "yaml",
      "json",
      "toml",
    ];

    // --- Scan content collections ---
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

        // Derive a human-readable title for the entry
        const primaryField = schema.view?.primary || "title";
        const entryTitle =
          contentObject[primaryField] ||
          entry.name.replace(/\.[^.]+$/, "");

        const links = extractInternalLinks(contentObject);
        for (const { url } of links) {
          if (mediaOutputPrefixes.some((prefix) => url.startsWith(prefix))) continue;
          if (!validUrls.has(url)) {
            brokenLinks.push({
              url,
              source: `${schema.label || schema.name} → ${entryTitle}`,
              collectionName: schema.name,
              entryPath: entry.path,
            });
          }
        }
      }
    }

    // --- Scan site.config.yaml ---
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

        // Collect nav and footer links with descriptive source paths
        const navLinks = extractInternalLinks(
          siteConfig?.navigation ?? {},
          "navigation",
        );
        const footerLinks = extractInternalLinks(
          siteConfig?.footer ?? {},
          "footer",
        );

        for (const { url, path: fieldPath } of [...navLinks, ...footerLinks]) {
          if (mediaOutputPrefixes.some((prefix) => url.startsWith(prefix))) continue;
          if (!validUrls.has(url)) {
            const section = fieldPath.startsWith("footer")
              ? "Settings → Footer"
              : "Settings → Navigation";
            brokenLinks.push({ url, source: section });
          }
        }
      }
    } catch {
      // site.config.yaml may not exist — skip silently
    }

    return Response.json({
      status: "success",
      data: {
        brokenLinks,
        scannedAt: new Date().toISOString(),
      },
    } satisfies BrokenLinksResponse);
  } catch (error: any) {
    console.error(error);
    return Response.json(
      { status: "error", message: error.message } satisfies BrokenLinksResponse,
      { status: 500 },
    );
  }
}
