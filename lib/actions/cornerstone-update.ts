"use server";

import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { getFileWithSha, commitFile } from "@/lib/github/wizard";
import {
  getLatestCornerstoneVersion,
  isBehindLatest,
  CORNERSTONE_CORE_DEP,
} from "@/lib/cornerstone-version";

export interface VersionStatus {
  /** The version range in the church's package.json, e.g. "^0.1.16" */
  current: string | null;
  /** The latest published version, e.g. "0.1.21" */
  latest: string | null;
  /** True when the current range floor is behind the latest major/minor */
  needsUpdate: boolean;
}

async function assertAccess(churchId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return;
  if (user.churchAssignment?.churchId !== churchId) throw new Error("Access denied.");
}

async function getSlug(churchId: string): Promise<string> {
  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
    columns: { slug: true },
  });
  if (!church) throw new Error("Church not found.");
  return church.slug;
}

/**
 * Returns the current version range from the church repo's package.json
 * alongside the latest published version, and whether an update is available.
 */
export async function getVersionStatus(churchId: string): Promise<VersionStatus> {
  await assertAccess(churchId);
  const slug = await getSlug(churchId);

  const [latest, current] = await Promise.all([
    getLatestCornerstoneVersion(),
    (async () => {
      try {
        const { content } = await getFileWithSha(slug, "package.json");
        const pkg = JSON.parse(content) as { dependencies?: Record<string, string> };
        return pkg.dependencies?.[CORNERSTONE_CORE_DEP] ?? null;
      } catch {
        return null;
      }
    })(),
  ]);

  const needsUpdate = Boolean(current && latest && isBehindLatest(current, latest));
  return { current, latest, needsUpdate };
}

/**
 * Updates the church repo's package.json to use ^{latest} for @cornerstone-web/core,
 * triggering a CF Pages rebuild. Safe to call multiple times (idempotent).
 *
 * Used as a server action from the homepage update prompt.
 */
export async function applyLatestVersion(
  churchId: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    await assertAccess(churchId);
    const slug = await getSlug(churchId);
    return await applyLatestVersionToRepo(slug);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}

/**
 * Internal helper — updates package.json in a repo by slug.
 * Not a server action; call from other server actions (e.g. launchChurch).
 */
export async function applyLatestVersionToRepo(
  slug: string,
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const latest = await getLatestCornerstoneVersion();
    if (!latest) return { ok: false, error: "Could not fetch latest version from GPR." };

    const { content, sha } = await getFileWithSha(slug, "package.json");
    const pkg = JSON.parse(content) as { dependencies?: Record<string, string> };

    const newRange = `^${latest}`;
    if (pkg.dependencies?.[CORNERSTONE_CORE_DEP] === newRange) {
      return { ok: true, version: latest }; // already up to date
    }

    pkg.dependencies = { ...(pkg.dependencies ?? {}), [CORNERSTONE_CORE_DEP]: newRange };

    await commitFile(
      slug,
      "package.json",
      JSON.stringify(pkg, null, 2) + "\n",
      sha,
      `chore: update @cornerstone-web/core to ^${latest}`,
    );

    return { ok: true, version: latest };
  } catch (err) {
    console.error("applyLatestVersionToRepo failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}
