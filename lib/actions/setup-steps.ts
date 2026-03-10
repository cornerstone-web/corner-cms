"use server";

import { updateSiteConfig, commitBinaryFile } from "@/lib/github/wizard";
import { completeStep } from "@/lib/actions/setup";
import { getAuth } from "@/lib/auth";

async function assertChurchAccess(churchId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return;
  if (user.churchAssignment?.churchId !== churchId) throw new Error("Access denied.");
}

export async function markWelcomeComplete(churchId: string): Promise<void> {
  await assertChurchAccess(churchId);
  const result = await completeStep(churchId, "welcome");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveIdentity(
  churchId: string,
  slug: string,
  updates: { name: string; tagline?: string },
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(slug, updates, "wizard: update church identity");
  const result = await completeStep(churchId, "identity");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveLogo(
  churchId: string,
  slug: string,
  base64Content: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  await commitBinaryFile(slug, "public/logo.png", base64Content, undefined, "wizard: add church logo");
  await updateSiteConfig(slug, { logoPath: "/logo.png" }, "wizard: set logoPath");
  const result = await completeStep(churchId, "logo");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveFavicon(
  churchId: string,
  slug: string,
  base64Content: string,
  ext: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  await commitBinaryFile(
    slug,
    `public/favicon.${ext}`,
    base64Content,
    undefined,
    "wizard: add favicon",
  );
  const result = await completeStep(churchId, "favicon");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveTheme(
  churchId: string,
  slug: string,
  preset: string,
  primaryColor?: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  const themeUpdate = {
    theme: {
      preset,
      ...(primaryColor ? { primaryColor } : {}),
    },
  };
  await updateSiteConfig(slug, themeUpdate, "wizard: set theme");
  const result = await completeStep(churchId, "theme");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveContact(
  churchId: string,
  slug: string,
  email: string,
  phone: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(slug, { contact: { email, phone } }, "wizard: add contact info");
  const result = await completeStep(churchId, "contact");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveLocation(
  churchId: string,
  slug: string,
  address: { street: string; city: string; state: string; zip: string },
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(
    slug,
    { contact: { address } },
    "wizard: add location",
  );
  const result = await completeStep(churchId, "location");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveServices(
  churchId: string,
  slug: string,
  serviceTimes: { day: string; time: string; label?: string }[],
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(slug, { serviceTimes }, "wizard: add service times");
  const result = await completeStep(churchId, "services");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveSocialLinks(
  churchId: string,
  slug: string,
  links: Record<string, string>,
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(slug, { footer: { socialLinks: links } }, "wizard: add social links");
  const result = await completeStep(churchId, "social");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveGiving(
  churchId: string,
  slug: string,
  url: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(slug, { giving: { url } }, "wizard: add giving URL");
  const result = await completeStep(churchId, "giving");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveStreaming(
  churchId: string,
  slug: string,
  youtubeApiKey: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  await updateSiteConfig(slug, { integrations: { youtubeApiKey } }, "wizard: add YouTube API key");
  const result = await completeStep(churchId, "streaming");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}
