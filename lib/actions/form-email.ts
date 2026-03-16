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

async function getChurchContext() {
  const { user } = await getAuth();
  if (!user?.churchAssignment) throw new Error("Not authenticated.");
  const { churchId } = user.churchAssignment;
  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
    columns: { slug: true, cfPagesUrl: true, displayName: true, githubRepoName: true },
  });
  if (!church) throw new Error("Church not found.");
  return { churchId, slug: church.slug, cfPagesUrl: church.cfPagesUrl, displayName: church.displayName, repoName: church.githubRepoName };
}

export async function initiateFormEmail(email: string) {
  const { churchId, slug } = await getChurchContext();
  return initiateContactFormVerification(churchId, slug, email);
}

export async function checkFormEmail(email: string) {
  const { churchId, slug } = await getChurchContext();
  return checkContactFormVerification(churchId, slug, email);
}

export async function removeFormEmail(email: string) {
  const { churchId, slug, repoName } = await getChurchContext();
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
export async function confirmFormEmail(email: string) {
  const { repoName, displayName, cfPagesUrl } = await getChurchContext();
  if (!cfPagesUrl) return { ok: false, error: "Site not yet launched." };
  try {
    await updateApostleForChurch(repoName, displayName, cfPagesUrl, email);
    return { ok: true };
  } catch (err) {
    console.error("confirmFormEmail: apostle update failed:", err);
    return { ok: false, error: "Failed to update corner-apostle." };
  }
}
