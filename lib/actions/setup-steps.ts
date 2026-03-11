"use server";

import { updateSiteConfig, commitBinaryFile, commitFile, tryGetSha, slugify, getFileWithSha } from "@/lib/github/wizard";
import YAML from "yaml";
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
  updates: { name: string; description?: string },
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
  const sha = await tryGetSha(slug, "public/images/logo.png");
  await commitBinaryFile(slug, "public/images/logo.png", base64Content, sha, "wizard: add church logo");
  const result = await completeStep(churchId, "logo");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveFavicon(
  churchId: string,
  slug: string,
  base64Content: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  const sha = await tryGetSha(slug, "public/favicon.svg");
  await commitBinaryFile(slug, "public/favicon.svg", base64Content, sha, "wizard: add favicon");
  const result = await completeStep(churchId, "favicon");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveTheme(
  churchId: string,
  slug: string,
  preset: string,
  customTheme?: Record<string, string>,
): Promise<void> {
  await assertChurchAccess(churchId);
  const themeUpdate: Record<string, unknown> = { theme: preset };
  if (preset === "custom" && customTheme) {
    themeUpdate.customTheme = customTheme;
  }
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
  links: { platform: string; url: string; label?: string; icon?: string }[],
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

export async function saveFeature(
  churchId: string,
  slug: string,
  feature: string,
  enabled: boolean,
  extra?: Record<string, unknown>,
): Promise<void> {
  await assertChurchAccess(churchId);
  const featureUpdate: Record<string, unknown> = { [feature]: enabled, ...extra };
  await updateSiteConfig(slug, { features: featureUpdate }, `wizard: ${enabled ? "enable" : "skip"} ${feature}`);
  const result = await completeStep(churchId, feature);
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export async function saveHero(
  churchId: string,
  slug: string,
  opts: { imageBase64?: string; imageExt?: string; videoUrl?: string },
): Promise<void> {
  await assertChurchAccess(churchId);

  if (opts.imageBase64) {
    const ext = opts.imageExt ?? "jpg";
    const heroPath = `public/hero.${ext}`;
    const sha = await tryGetSha(slug, heroPath);
    await commitBinaryFile(slug, heroPath, opts.imageBase64, sha, "wizard: add hero image");
    await updateSiteConfig(slug, { heroImage: `/hero.${ext}` }, "wizard: set hero image");
  } else if (opts.videoUrl) {
    await updateSiteConfig(slug, { heroVideo: opts.videoUrl }, "wizard: set hero video");
  }

  const result = await completeStep(churchId, "hero");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function savePhotos(
  churchId: string,
  slug: string,
  photos: { base64: string; ext: string; name: string }[],
): Promise<void> {
  await assertChurchAccess(churchId);

  await Promise.all(
    photos.map(async (photo) => {
      const filename = slugify(photo.name.replace(/\.[^.]+$/, "")) + "." + photo.ext;
      const photoPath = `public/marquee/${filename}`;
      const sha = await tryGetSha(slug, photoPath);
      await commitBinaryFile(slug, photoPath, photo.base64, sha, "wizard: add marquee photo");
    }),
  );

  const result = await completeStep(churchId, "photos");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Content file helpers ──────────────────────────────────────────────────────

function fm(fields: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") lines.push(`${k}: "${v.replace(/"/g, '\\"')}"`);
    else lines.push(`${k}: ${JSON.stringify(v)}`);
  }
  lines.push("---");
  lines.push("");
  return lines.join("\n");
}

export async function commitContentFile(
  churchId: string,
  slug: string,
  path: string,
  content: string,
  message: string,
  stepKey: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, message);
  const result = await completeStep(churchId, stepKey);
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function commitContentBinaryFile(
  churchId: string,
  slug: string,
  path: string,
  base64: string,
  message: string,
): Promise<void> {
  await assertChurchAccess(churchId);
  const sha = await tryGetSha(slug, path);
  await commitBinaryFile(slug, path, base64, sha, message);
}

// ─── First Sermon ─────────────────────────────────────────────────────────────

export async function saveFirstSermon(
  churchId: string,
  slug: string,
  fields: {
    title: string;
    date: string;
    speaker: string;
    series?: string;
    description?: string;
  },
): Promise<void> {
  await assertChurchAccess(churchId);
  const fileSlug = slugify(fields.title) || "first-sermon";
  const path = `src/content/sermons/${fileSlug}.md`;
  const content = fm({
    title: fields.title,
    date: fields.date,
    speaker: fields.speaker,
    ...(fields.series ? { series: fields.series } : {}),
    ...(fields.description ? { description: fields.description } : {}),
    draft: false,
    blocks: [{ type: "video-embed", youtubeUrl: "" }],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first sermon");
  const result = await completeStep(churchId, "first-sermon");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Series ─────────────────────────────────────────────────────────────

export async function saveFirstSeries(
  churchId: string,
  slug: string,
  fields: { title: string; description?: string },
): Promise<void> {
  await assertChurchAccess(churchId);
  const fileSlug = slugify(fields.title) || "first-series";
  const path = `src/content/series/${fileSlug}.md`;
  const content = fm({
    title: fields.title,
    ...(fields.description ? { description: fields.description } : {}),
    draft: false,
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first series");
  const result = await completeStep(churchId, "first-series");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Ministries ─────────────────────────────────────────────────────────

export async function saveFirstMinistries(
  churchId: string,
  slug: string,
  ministries: { name: string; description?: string; icon?: string }[],
): Promise<void> {
  await assertChurchAccess(churchId);
  await Promise.all(ministries.map(async (ministry) => {
    if (!ministry.name.trim()) return;
    const fileSlug = slugify(ministry.name) || "ministry";
    const path = `src/content/ministries/${fileSlug}.md`;
    const content = fm({
      title: ministry.name,
      ...(ministry.description ? { description: ministry.description } : {}),
      ...(ministry.icon ? { icon: ministry.icon } : {}),
      draft: false,
    });
    const sha = await tryGetSha(slug, path);
    await commitFile(slug, path, content, sha, "wizard: add ministry");
  }));
  const result = await completeStep(churchId, "first-ministry");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Event ──────────────────────────────────────────────────────────────

export async function saveFirstEvent(
  churchId: string,
  slug: string,
  fields: {
    title: string;
    date: string;
    time: string;
    location?: string;
    description?: string;
  },
): Promise<void> {
  await assertChurchAccess(churchId);
  const fileSlug = slugify(fields.title) || "first-event";
  const path = `src/content/events/${fileSlug}.md`;
  const content = fm({
    title: fields.title,
    date: fields.date,
    time: fields.time,
    ...(fields.location ? { location: fields.location } : {}),
    ...(fields.description ? { description: fields.description } : {}),
    draft: false,
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first event");
  const result = await completeStep(churchId, "first-event");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Article ────────────────────────────────────────────────────────────

export async function saveFirstArticle(
  churchId: string,
  slug: string,
  fields: { title: string; author: string; description?: string },
): Promise<void> {
  await assertChurchAccess(churchId);
  const fileSlug = slugify(fields.title) || "first-article";
  const path = `src/content/articles/${fileSlug}.md`;
  const today = new Date().toISOString().split("T")[0];
  const content = fm({
    title: fields.title,
    author: fields.author,
    date: today,
    ...(fields.description ? { description: fields.description } : {}),
    draft: false,
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first article");
  const result = await completeStep(churchId, "first-article");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Staff Members ────────────────────────────────────────────────────────────

export async function saveStaffMembers(
  churchId: string,
  slug: string,
  members: { name: string; title?: string; bio?: string; photoBase64?: string; photoExt?: string }[],
): Promise<void> {
  await assertChurchAccess(churchId);
  await Promise.all(members.map(async (member) => {
    if (!member.name.trim()) return;
    const fileSlug = slugify(member.name) || "staff";
    if (member.photoBase64) {
      const ext = member.photoExt ?? "jpg";
      const photoPath = `public/staff/${fileSlug}.${ext}`;
      const photoSha = await tryGetSha(slug, photoPath);
      await commitBinaryFile(slug, photoPath, member.photoBase64, photoSha, "wizard: add staff photo");
    }
    const hasPhoto = Boolean(member.photoBase64);
    const ext = member.photoExt ?? "jpg";
    const mdPath = `src/content/staff/${fileSlug}.md`;
    const content = fm({
      name: member.name,
      ...(member.title ? { title: member.title } : {}),
      ...(member.bio ? { bio: member.bio } : {}),
      ...(hasPhoto ? { photo: `/staff/${fileSlug}.${ext}` } : {}),
      draft: false,
    });
    const sha = await tryGetSha(slug, mdPath);
    await commitFile(slug, mdPath, content, sha, "wizard: add staff member");
  }));
  const result = await completeStep(churchId, "first-staff");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Leaders ──────────────────────────────────────────────────────────────────

export async function saveLeaders(
  churchId: string,
  slug: string,
  leaders: { name: string; role: string; photoBase64?: string; photoExt?: string }[],
): Promise<void> {
  await assertChurchAccess(churchId);
  await Promise.all(leaders.map(async (leader) => {
    if (!leader.name.trim()) return;
    const fileSlug = slugify(leader.name) || "leader";
    if (leader.photoBase64) {
      const ext = leader.photoExt ?? "jpg";
      const photoPath = `public/leadership/${fileSlug}.${ext}`;
      const photoSha = await tryGetSha(slug, photoPath);
      await commitBinaryFile(slug, photoPath, leader.photoBase64, photoSha, "wizard: add leader photo");
    }
    const hasPhoto = Boolean(leader.photoBase64);
    const ext = leader.photoExt ?? "jpg";
    const mdPath = `src/content/leadership/${fileSlug}.md`;
    const content = fm({
      name: leader.name,
      role: leader.role,
      ...(hasPhoto ? { photo: `/leadership/${fileSlug}.${ext}` } : {}),
      draft: false,
    });
    const sha = await tryGetSha(slug, mdPath);
    await commitFile(slug, mdPath, content, sha, "wizard: add leader");
  }));
  const result = await completeStep(churchId, "first-leaders");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Contact Form Verification ────────────────────────────────────────────────

/**
 * Creates a CF Email Routing destination address for the given email,
 * which triggers a verification email to that address.
 * Idempotent — safe to call again if the address already exists.
 */
export async function initiateContactFormVerification(
  churchId: string,
  slug: string,
  email: string,
): Promise<{ ok: boolean; email?: string; alreadyVerified?: boolean; error?: string }> {
  await assertChurchAccess(churchId);

  if (!email) return { ok: false, error: "Please enter an email address." };

  // Persist the chosen form email so launchChurch can register it with corner-apostle
  await updateSiteConfig(slug, { contact: { formEmail: email } }, "wizard: set form email");

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) return { ok: false, error: "Cloudflare not configured." };

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    },
  );

  if (res.ok) {
    return { ok: true, email };
  }

  if (res.status === 409) {
    // Address already registered — check if already verified
    const check = await checkContactFormVerification(churchId, slug, email);
    return { ok: true, email, alreadyVerified: check.verified };
  }

  const errBody = await res.json().catch(() => ({}));
  console.error("CF Email Routing address creation failed:", errBody);
  return { ok: false, error: "Failed to initiate email verification." };
}

/**
 * Checks whether the church's contact email has been verified as a
 * CF Email Routing destination address.
 */
export async function checkContactFormVerification(
  churchId: string,
  slug: string,
  email: string,
): Promise<{ verified: boolean; email?: string; error?: string }> {
  await assertChurchAccess(churchId);

  if (!email) return { verified: false, error: "No email provided." };

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  if (!accountId || !apiToken) return { verified: false, error: "Cloudflare not configured." };

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses?per_page=50`,
    { headers: { Authorization: `Bearer ${apiToken}` } },
  );

  if (!res.ok) return { verified: false, error: "Failed to reach Cloudflare API." };

  const data = await res.json() as { result?: { email: string; verified: string | null }[] };
  const address = data.result?.find((a) => a.email === email);

  return { verified: !!address?.verified, email };
}
