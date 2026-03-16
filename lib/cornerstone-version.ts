const GPR_PACKAGE_URL = "https://npm.pkg.github.com/@cornerstone-web%2fcore";

export const CORNERSTONE_CORE_DEP = "@cornerstone-web/core";

/**
 * Strips semver range prefixes (^, ~, >=, etc.) and returns [major, minor, patch].
 */
function parseVersionParts(v: string): [number, number, number] {
  const clean = v.replace(/^[\^~>=<\s]+/, "");
  const parts = clean.split(".").map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Returns true if `latest` is in a higher major or minor than `current`.
 * Patch bumps are intentionally ignored — ^ ranges cover them automatically.
 */
export function isBehindLatest(current: string, latest: string): boolean {
  const [cMaj, cMin] = parseVersionParts(current);
  const [lMaj, lMin] = parseVersionParts(latest);
  if (lMaj > cMaj) return true;
  if (lMaj === cMaj && lMin > cMin) return true;
  return false;
}

/**
 * Fetches the latest published version of @cornerstone-web/core from GPR.
 * Requires CF_PAGES_GITHUB_TOKEN with read:packages scope.
 * Results are cached for 1 hour per Next.js fetch deduplication.
 */
export async function getLatestCornerstoneVersion(): Promise<string | null> {
  const token = process.env.CF_PAGES_GITHUB_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(GPR_PACKAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { "dist-tags"?: { latest?: string } };
    return data["dist-tags"]?.latest ?? null;
  } catch {
    return null;
  }
}
