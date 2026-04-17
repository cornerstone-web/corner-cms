"use server";

import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  initiateContactFormVerification,
  checkContactFormVerification,
  removeContactFormEmail,
} from "./setup-steps";
import { updateApostleForChurch, clearApostleEmail } from "./setup";

async function getSiteContext(repoSlug?: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");

  if (user.isSuperAdmin && repoSlug) {
    // Super admins don't have a siteAssignment — look up site by repo slug
    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.slug, repoSlug),
      columns: { id: true, slug: true, cfPagesUrl: true, customDomain: true, displayName: true },
    });
    if (!site) throw new Error("Site not found.");
    return { siteId: site.id, slug: site.slug, cfPagesUrl: site.cfPagesUrl, customDomain: site.customDomain, displayName: site.displayName, repoName: site.slug };
  }

  if (!user.siteAssignment) throw new Error("Not authenticated.");
  const siteId = user.siteAssignment.siteId;
  const site = await db.query.sitesTable.findFirst({
    where: eq(sitesTable.id, siteId),
    columns: { slug: true, cfPagesUrl: true, customDomain: true, displayName: true },
  });
  if (!site) throw new Error("Site not found.");
  // repoName uses slug (matches the key used in corner-apostle's registry.json)
  return { siteId, slug: site.slug, cfPagesUrl: site.cfPagesUrl, customDomain: site.customDomain, displayName: site.displayName, repoName: site.slug };
}

export async function initiateFormEmail(email: string, repoSlug?: string) {
  const { siteId, slug } = await getSiteContext(repoSlug);
  return initiateContactFormVerification(siteId, slug, email);
}

export async function checkFormEmail(email: string, repoSlug?: string) {
  const { siteId, slug } = await getSiteContext(repoSlug);
  return checkContactFormVerification(siteId, slug, email);
}

export async function removeFormEmail(email: string, repoSlug?: string) {
  const { siteId, slug, repoName } = await getSiteContext(repoSlug);
  const result = await removeContactFormEmail(siteId, slug, email);
  if (result.ok) {
    await clearApostleEmail(repoName, email);
  }
  return result;
}

/**
 * Called from the settings widget when a new email is confirmed verified.
 * Updates corner-apostle registry.json and wrangler.jsonc with the new address.
 */
export async function confirmFormEmail(email: string, repoSlug?: string) {
  const { repoName, displayName, cfPagesUrl, customDomain } = await getSiteContext(repoSlug);
  if (!cfPagesUrl) return { ok: false, error: "Site not yet launched." };
  try {
    await updateApostleForChurch(repoName, displayName, cfPagesUrl, email, customDomain ?? undefined);
    return { ok: true };
  } catch (err) {
    console.error("confirmFormEmail: apostle update failed:", err);
    return { ok: false, error: "Failed to update corner-apostle." };
  }
}
