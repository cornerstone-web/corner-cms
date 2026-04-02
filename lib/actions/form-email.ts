"use server";

import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  initiateContactFormVerification,
  checkContactFormVerification,
  removeContactFormEmail,
} from "./setup-steps";
import { updateApostleForChurch, clearApostleEmail } from "./setup";

async function getChurchContext(repoSlug?: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");

  if (user.isSuperAdmin && repoSlug) {
    // Super admins don't have a churchAssignment — look up church by repo slug
    const church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.slug, repoSlug),
      columns: { id: true, slug: true, cfPagesUrl: true, customDomain: true, displayName: true },
    });
    if (!church) throw new Error("Church not found.");
    return { churchId: church.id, slug: church.slug, cfPagesUrl: church.cfPagesUrl, customDomain: church.customDomain, displayName: church.displayName, repoName: church.slug };
  }

  if (!user.churchAssignment) throw new Error("Not authenticated.");
  const churchId = user.churchAssignment.churchId;
  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
    columns: { slug: true, cfPagesUrl: true, customDomain: true, displayName: true },
  });
  if (!church) throw new Error("Church not found.");
  // repoName uses slug (matches the key used in corner-apostle's registry.json)
  return { churchId, slug: church.slug, cfPagesUrl: church.cfPagesUrl, customDomain: church.customDomain, displayName: church.displayName, repoName: church.slug };
}

export async function initiateFormEmail(email: string, repoSlug?: string) {
  const { churchId, slug } = await getChurchContext(repoSlug);
  return initiateContactFormVerification(churchId, slug, email);
}

export async function checkFormEmail(email: string, repoSlug?: string) {
  const { churchId, slug } = await getChurchContext(repoSlug);
  return checkContactFormVerification(churchId, slug, email);
}

export async function removeFormEmail(email: string, repoSlug?: string) {
  const { churchId, slug, repoName } = await getChurchContext(repoSlug);
  const result = await removeContactFormEmail(churchId, slug, email);
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
  const { repoName, displayName, cfPagesUrl, customDomain } = await getChurchContext(repoSlug);
  if (!cfPagesUrl) return { ok: false, error: "Site not yet launched." };
  try {
    await updateApostleForChurch(repoName, displayName, cfPagesUrl, email, customDomain ?? undefined);
    return { ok: true };
  } catch (err) {
    console.error("confirmFormEmail: apostle update failed:", err);
    return { ok: false, error: "Failed to update corner-apostle." };
  }
}
