"use server";

import { updateSiteConfig, commitBinaryFile, commitFile, tryGetSha, slugify, getFileWithSha } from "@/lib/github/wizard";
import YAML from "yaml";
import { completeStep, uncompleteStep } from "@/lib/actions/setup";
import { getAuth } from "@/lib/auth";

async function assertSiteAccess(siteId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return;
  if (user.siteAssignment?.siteId !== siteId) throw new Error("Access denied.");
}

export async function markWelcomeComplete(siteId: string): Promise<void> {
  await assertSiteAccess(siteId);
  const result = await completeStep(siteId, "welcome");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveIdentity(
  siteId: string,
  slug: string,
  updates: { name: string; description?: string },
): Promise<void> {
  await assertSiteAccess(siteId);
  await updateSiteConfig(slug, updates, "wizard: update site identity");
  const result = await completeStep(siteId, "identity");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveLogo(
  siteId: string,
  slug: string,
  base64Content: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const sha = await tryGetSha(slug, "public/images/logo.png");
  await commitBinaryFile(slug, "public/images/logo.png", base64Content, sha, "wizard: add site logo");
  const result = await completeStep(siteId, "logo");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveFavicon(
  siteId: string,
  slug: string,
  base64Content: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const sha = await tryGetSha(slug, "public/favicon.svg");
  await commitBinaryFile(slug, "public/favicon.svg", base64Content, sha, "wizard: add favicon");
  const result = await completeStep(siteId, "favicon");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveTheme(
  siteId: string,
  slug: string,
  preset: string,
  customTheme?: Record<string, string>,
): Promise<void> {
  await assertSiteAccess(siteId);
  const themeUpdate: Record<string, unknown> = { theme: preset };
  if (preset === "custom" && customTheme) {
    themeUpdate.customTheme = customTheme;
  }
  await updateSiteConfig(slug, themeUpdate, "wizard: set theme");
  const result = await completeStep(siteId, "theme");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveContact(
  siteId: string,
  slug: string,
  email: string,
  phone: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  await updateSiteConfig(slug, { contact: { email, phone } }, "wizard: add contact info");
  const result = await completeStep(siteId, "contact");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveLocation(
  siteId: string,
  slug: string,
  address: { street: string; city: string; state: string; zip: string },
): Promise<void> {
  await assertSiteAccess(siteId);
  await updateSiteConfig(
    slug,
    { contact: { address } },
    "wizard: add location",
  );
  const result = await completeStep(siteId, "location");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveServices(
  siteId: string,
  slug: string,
  serviceTimes: { day: string; time: string; label?: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);
  await updateSiteConfig(slug, { serviceTimes }, "wizard: add service times");
  const result = await completeStep(siteId, "services");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveSocialLinks(
  siteId: string,
  slug: string,
  links: { platform: string; url: string; label?: string; icon?: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);
  // Write full footer structure so footer.sections and footer.variant always exist
  // (corner-template starts without a footer key; deepMerge can't fill in missing fields)
  await updateSiteConfig(slug, {
    footer: { variant: "comprehensive", style: "centered", socialLinks: links, sections: [] },
  }, "wizard: add social links");
  const result = await completeStep(siteId, "social");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveGiving(
  siteId: string,
  slug: string,
  url: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  await updateSiteConfig(slug, { giving: { url } }, "wizard: add giving URL");
  const result = await completeStep(siteId, "giving");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveStreaming(
  siteId: string,
  slug: string,
  youtubeApiKey: string,
  youtubeChannelId: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  await updateSiteConfig(slug, { integrations: { youtubeApiKey, youtubeChannelId } }, "wizard: add YouTube streaming config");
  const result = await completeStep(siteId, "streaming");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveFeature(
  siteId: string,
  slug: string,
  feature: string,
  enabled: boolean,
  extra?: Record<string, unknown>,
): Promise<void> {
  await assertSiteAccess(siteId);
  const featureUpdate: Record<string, unknown> = { [feature]: enabled, ...extra };
  await updateSiteConfig(slug, { features: featureUpdate }, `wizard: ${enabled ? "enable" : "skip"} ${feature}`);
  const result = await completeStep(siteId, feature);
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Home Page ────────────────────────────────────────────────────────────────

export async function saveHero(
  siteId: string,
  slug: string,
  opts: { imageBase64?: string; imageExt?: string; videoUrl?: string },
): Promise<void> {
  await assertSiteAccess(siteId);

  if (opts.imageBase64) {
    const heroPath = `public/uploads/hero.jpg`;
    const sha = await tryGetSha(slug, heroPath);
    await commitBinaryFile(slug, heroPath, opts.imageBase64, sha, "wizard: add hero image");
  }

  const result = await completeStep(siteId, "hero");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function savePhotos(
  siteId: string,
  slug: string,
  photos: { base64: string; ext: string; name: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);

  await Promise.all(
    photos.map(async (photo) => {
      const filename = slugify(photo.name.replace(/\.[^.]+$/, "")) + "." + photo.ext;
      const photoPath = `public/uploads/marquee/${filename}`;
      const sha = await tryGetSha(slug, photoPath);
      await commitBinaryFile(slug, photoPath, photo.base64, sha, "wizard: add marquee photo");
    }),
  );

  const result = await completeStep(siteId, "photos");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Content file helpers ──────────────────────────────────────────────────────

function fm(fields: Record<string, unknown>): string {
  const filtered = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined && v !== null),
  );
  return `---\n${YAML.stringify(filtered, { lineWidth: 0 })}---\n`;
}

export async function commitContentFile(
  siteId: string,
  slug: string,
  path: string,
  content: string,
  message: string,
  stepKey: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, message);
  const result = await completeStep(siteId, stepKey);
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function commitContentBinaryFile(
  siteId: string,
  slug: string,
  path: string,
  base64: string,
  message: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const sha = await tryGetSha(slug, path);
  await commitBinaryFile(slug, path, base64, sha, message);
}

// ─── First Sermon ─────────────────────────────────────────────────────────────

export async function saveFirstSermon(
  siteId: string,
  slug: string,
  fields: {
    title: string;
    date: string;
    speaker: string;
    series?: string;
    description?: string;
    proseContent?: string;
    videoUrl?: string;
    imageBase64?: string;
    imageExt?: string;
  },
): Promise<void> {
  await assertSiteAccess(siteId);
  const fileSlug = slugify(fields.title) || "first-sermon";
  const path = `src/content/sermons/${fileSlug}.md`;

  let imagePath: string | undefined;
  if (fields.imageBase64) {
    const ext = fields.imageExt ?? "jpg";
    const repoImagePath = `public/uploads/sermons/${fileSlug}.${ext}`;
    const imageSha = await tryGetSha(slug, repoImagePath);
    await commitBinaryFile(slug, repoImagePath, fields.imageBase64, imageSha, "wizard: add sermon image");
    imagePath = `/uploads/sermons/${fileSlug}.${ext}`;
  }
  const blocks = [
    ...(fields.videoUrl
      ? [
          {
            type: "video-embed",
            useYoutubeLive: false,
            url: fields.videoUrl,
            aspectRatio: "16:9",
            showTitle: true,
            title: fields.title,
          },
        ]
      : []),
    { type: "prose", maxWidth: "normal", content: fields.proseContent ?? "" },
    {
      type: "cta",
      variant: "primary",
      headline: "Want to learn more?",
      showDescription: false,
      showPrimaryCta: true,
      primaryCta: { label: "View All Sermons", href: "/sermons" },
      showSecondaryCta: false,
    },
  ];
  const content = fm({
    title: fields.title,
    template: "sermon",
    date: fields.date,
    speaker: fields.speaker,
    ...(fields.series ? { series: fields.series } : {}),
    description: fields.description ?? "",
    ...(imagePath ? { image: imagePath } : {}),
    draft: false,
    passwordProtected: false,
    blocks,
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first sermon");
  const result = await completeStep(siteId, "first-sermon");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Series ─────────────────────────────────────────────────────────────

export async function saveFirstSeries(
  siteId: string,
  slug: string,
  fields: { title: string; description?: string },
): Promise<void> {
  await assertSiteAccess(siteId);
  const fileSlug = slugify(fields.title) || "first-series";
  const path = `src/content/series/${fileSlug}.md`;
  const content = fm({
    title: fields.title,
    template: "series",
    description: fields.description ?? "",
    showDetailPage: true,
    draft: false,
    passwordProtected: false,
    blocks: [
      {
        type: "hero",
        variant: "centered",
        blockHeight: "sm",
        backgroundType: "image",
        backgroundImage: "/uploads/hero.jpg",
        overlayOpacity: 50,
        overlayGradient: "top-bottom",
        showHeadline: true,
        headline: fields.title,
        showSubheadline: fields.description ? true : false,
        ...(fields.description ? { subheadline: fields.description } : {}),
        showPrimaryCta: false,
        showSecondaryCta: false,
        showScrollIndicator: false,
      },
      {
        type: "sermon-grid",
        showTitle: false,
        showDescription: false,
        showAll: true,
        showViewAll: false,
      },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first series");
  const result = await completeStep(siteId, "first-series");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Ministries ─────────────────────────────────────────────────────────

export async function saveFirstMinistries(
  siteId: string,
  slug: string,
  ministries: { name: string; description?: string; icon?: string; proseContent?: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);
  await Promise.all(ministries.map(async (ministry) => {
    if (!ministry.name.trim()) return;
    const fileSlug = slugify(ministry.name) || "ministry";
    const path = `src/content/ministries/${fileSlug}.md`;
    const content = fm({
      title: ministry.name,
      template: "ministry",
      description: ministry.description ?? "",
      ...(ministry.icon ? { icon: ministry.icon } : {}),
      draft: false,
      passwordProtected: false,
      showDetailPage: true,
      blocks: [
        {
          type: "hero",
          variant: "centered",
          blockHeight: "sm",
          backgroundType: "image",
          backgroundImage: "/uploads/hero.jpg",
          overlayOpacity: 50,
          overlayGradient: "top-bottom",
          showHeadline: true,
          headline: ministry.name,
          showSubheadline: !!ministry.description,
          subheadline: ministry.description ?? "",
          showPrimaryCta: false,
          showSecondaryCta: false,
          showScrollIndicator: false,
        },
        { type: "prose", maxWidth: "normal", content: ministry.proseContent ?? "" },
        {
          type: "cta",
          variant: "primary",
          headline: "Want to get connected?",
          showDescription: false,
          showPrimaryCta: true,
          primaryCta: { label: "Contact Us", href: "/contact" },
          showSecondaryCta: false,
        },
      ],
    });
    const sha = await tryGetSha(slug, path);
    await commitFile(slug, path, content, sha, "wizard: add ministry");
  }));
  const result = await completeStep(siteId, "first-ministry");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Event ──────────────────────────────────────────────────────────────

export async function saveFirstEvent(
  siteId: string,
  slug: string,
  fields: {
    title: string;
    date: string;
    time: string;
    location?: string;
    description?: string;
    proseContent?: string;
  },
): Promise<void> {
  await assertSiteAccess(siteId);
  const fileSlug = slugify(fields.title) || "first-event";
  const path = `src/content/events/${fileSlug}.md`;
  const content = fm({
    title: fields.title,
    template: "event",
    date: fields.date,
    time: fields.time,
    location: fields.location ?? "",
    description: fields.description ?? "",
    draft: false,
    passwordProtected: false,
    blocks: [
      {
        type: "hero",
        variant: "centered",
        blockHeight: "sm",
        backgroundType: "image",
        backgroundImage: "/uploads/hero.jpg",
        overlayOpacity: 50,
        overlayGradient: "top-bottom",
        showHeadline: true,
        headline: fields.title,
        showSubheadline: !!fields.description,
        subheadline: fields.description ?? "",
        showPrimaryCta: false,
        showSecondaryCta: false,
        showScrollIndicator: false,
      },
      { type: "prose", maxWidth: "normal", content: fields.proseContent ?? "" },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first event");
  const result = await completeStep(siteId, "first-event");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Article ────────────────────────────────────────────────────────────

export async function saveFirstArticle(
  siteId: string,
  slug: string,
  fields: { title: string; author: string; category?: string; description?: string; proseContent?: string; imageBase64?: string; imageExt?: string },
): Promise<void> {
  await assertSiteAccess(siteId);
  const fileSlug = slugify(fields.title) || "first-article";
  const path = `src/content/articles/${fileSlug}.md`;
  const today = new Date().toISOString().split("T")[0];

  let imagePath: string | undefined;
  if (fields.imageBase64) {
    const ext = fields.imageExt ?? "jpg";
    const repoImagePath = `public/uploads/articles/${fileSlug}.${ext}`;
    const imageSha = await tryGetSha(slug, repoImagePath);
    await commitBinaryFile(slug, repoImagePath, fields.imageBase64, imageSha, "wizard: add article image");
    imagePath = `/uploads/articles/${fileSlug}.${ext}`;
  }

  const content = fm({
    title: fields.title,
    template: "article",
    author: fields.author,
    date: today,
    category: fields.category ?? "",
    description: fields.description ?? "",
    ...(imagePath ? { image: imagePath } : {}),
    draft: false,
    passwordProtected: false,
    blocks: [
      {
        type: "hero",
        variant: "centered",
        blockHeight: "sm",
        backgroundType: "image",
        backgroundImage: "/uploads/hero.jpg",
        overlayOpacity: 50,
        overlayGradient: "top-bottom",
        showHeadline: true,
        headline: fields.title,
        showSubheadline: !!fields.description,
        subheadline: fields.description ?? "",
        showPrimaryCta: false,
        showSecondaryCta: false,
        showScrollIndicator: false,
      },
      { type: "prose", maxWidth: "normal", content: fields.proseContent ?? "" },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: add first article");
  const result = await completeStep(siteId, "first-article");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Staff Members ────────────────────────────────────────────────────────────

export async function saveStaffMembers(
  siteId: string,
  slug: string,
  members: { name: string; title?: string; showDetailPage?: boolean; proseContent?: string; photoBase64?: string; photoExt?: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);
  await Promise.all(members.map(async (member) => {
    if (!member.name.trim()) return;
    const fileSlug = slugify(member.name) || "staff";
    if (member.photoBase64) {
      const ext = member.photoExt ?? "jpg";
      const photoPath = `public/uploads/leadership_staff/${fileSlug}.${ext}`;
      const photoSha = await tryGetSha(slug, photoPath);
      await commitBinaryFile(slug, photoPath, member.photoBase64, photoSha, "wizard: add staff photo");
    }
    const hasPhoto = Boolean(member.photoBase64);
    const ext = member.photoExt ?? "jpg";
    const mdPath = `src/content/staff/${fileSlug}.md`;
    const content = fm({
      name: member.name,
      template: "staff",
      role: member.title ?? "",
      bio: "",
      image: hasPhoto ? `/uploads/leadership_staff/${fileSlug}.${ext}` : "",
      draft: false,
      passwordProtected: false,
      showDetailPage: member.showDetailPage !== false,
      blocks: member.showDetailPage !== false
        ? [{ type: "prose", maxWidth: "normal", content: member.proseContent ?? "" }]
        : [],
    });
    const sha = await tryGetSha(slug, mdPath);
    await commitFile(slug, mdPath, content, sha, "wizard: add staff member");
  }));
  const result = await completeStep(siteId, "first-staff");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Leaders ──────────────────────────────────────────────────────────────────

export async function saveLeaders(
  siteId: string,
  slug: string,
  leaders: { name: string; role: string; photoBase64?: string; photoExt?: string; existingPhotoPath?: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);

  // Resolve the final photo path for each leader (new upload takes priority over existing)
  const resolved = await Promise.all(leaders.filter(l => l.name.trim()).map(async (leader) => {
    const fileSlug = slugify(leader.name) || "leader";
    let photoPath: string | undefined;
    if (leader.photoBase64) {
      const ext = leader.photoExt ?? "jpg";
      const repoPath = `public/uploads/leadership_staff/${fileSlug}.${ext}`;
      const photoSha = await tryGetSha(slug, repoPath);
      await commitBinaryFile(slug, repoPath, leader.photoBase64, photoSha, "wizard: add leader photo");
      photoPath = `/uploads/leadership_staff/${fileSlug}.${ext}`;
    } else if (leader.existingPhotoPath) {
      photoPath = leader.existingPhotoPath;
    }
    return { ...leader, fileSlug, photoPath };
  }));

  // Build leadership page: one team-grid per unique role
  const byRole = new Map<string, typeof resolved>();
  for (const leader of resolved) {
    const role = leader.role.trim();
    if (!byRole.has(role)) byRole.set(role, []);
    byRole.get(role)!.push(leader);
  }
  const teamGrids = [...byRole.entries()].map(([role, people]) => ({
    type: "team-grid",
    imageStyle: "circle",
    gridAlignment: "left",
    gridSpacing: "normal",
    gridItemSize: "medium",
    showTitle: true,
    title: `${role}s`,
    showDescription: false,
    showBio: false,
    useCollectionSource: false,
    source: "staff",
    people: people.map(p => ({
      name: p.name.trim(),
      ...(p.photoPath ? { image: p.photoPath, imageAlt: p.name.trim() } : {}),
      subtitle: role,
    })),
  }));
  const leadershipPagePath = "src/content/pages/leadership.md";
  const leadershipPageContent = fm({
    title: "Our Leadership",
    description: "Meet our leadership",
    template: "leadership",
    draft: false,
    passwordProtected: false,
    blocks: [
      {
        type: "hero",
        variant: "centered",
        blockHeight: "sm",
        backgroundType: "image",
        backgroundImage: "/uploads/hero.jpg",
        overlayOpacity: 50,
        overlayGradient: "top-bottom",
        showHeadline: true,
        headline: "Our Leadership",
        showSubheadline: false,
        showPrimaryCta: false,
        showSecondaryCta: false,
        showScrollIndicator: false,
      },
      ...teamGrids,
      {
        type: "cta",
        variant: "primary",
        headline: "Want to connect with our leadership?",
        showDescription: false,
        showPrimaryCta: true,
        primaryCta: { label: "Contact Us", href: "/contact" },
        showSecondaryCta: false,
      },
    ],
  });
  const leadershipPageSha = await tryGetSha(slug, leadershipPagePath);
  await commitFile(slug, leadershipPagePath, leadershipPageContent, leadershipPageSha, "wizard: update leadership page");

  const result = await completeStep(siteId, "first-leaders");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Page Content Steps ───────────────────────────────────────────────────────

const SECONDARY_HERO = {
  type: "hero",
  variant: "centered",
  blockHeight: "sm",
  backgroundType: "image",
  backgroundImage: "/uploads/hero.jpg",
  overlayOpacity: 50,
  overlayGradient: "top-bottom",
  showHeadline: true,
  showSubheadline: false,
  showPrimaryCta: false,
  showSecondaryCta: false,
  showScrollIndicator: false,
};

export async function saveAboutPage(
  siteId: string,
  slug: string,
  proseContent: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const path = "src/content/pages/about.md";
  const content = fm({
    title: "About Us",
    description: "Learn about our history, mission, and values.",
    template: "default",
    draft: false,
    passwordProtected: false,
    blocks: [
      { ...SECONDARY_HERO, headline: "About Us" },
      { type: "prose", maxWidth: "normal", content: proseContent },
      {
        type: "cta",
        variant: "primary",
        headline: "Come visit us",
        showDescription: true,
        description: "We'd love to meet you and welcome you to our community.",
        showPrimaryCta: true,
        primaryCta: { label: "Plan Your Visit", href: "/visit" },
        showSecondaryCta: false,
      },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: update about page content");
  const result = await completeStep(siteId, "about-content");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveBeliefPage(
  siteId: string,
  slug: string,
  proseContent: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const path = "src/content/pages/beliefs.md";
  const content = fm({
    title: "What We Believe",
    description: "Learn about our core beliefs and values.",
    template: "default",
    draft: false,
    passwordProtected: false,
    blocks: [
      { ...SECONDARY_HERO, headline: "What We Believe" },
      { type: "prose", maxWidth: "normal", content: proseContent },
      {
        type: "cta",
        headline: "Have questions about our beliefs?",
        showPrimaryCta: true,
        primaryCta: { label: "Contact Us", href: "/contact" },
        showSecondaryCta: true,
        secondaryCta: { label: "Visit Our FAQ", href: "/faq" },
        variant: "primary",
      },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: update beliefs page content");
  const result = await completeStep(siteId, "beliefs-content");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveVisitPage(
  siteId: string,
  slug: string,
  proseContent: string,
): Promise<void> {
  await assertSiteAccess(siteId);
  const path = "src/content/pages/visit.md";
  const content = fm({
    title: "Plan Your Visit",
    description: "Everything you need to know before your first visit.",
    template: "default",
    draft: false,
    passwordProtected: false,
    blocks: [
      { ...SECONDARY_HERO, headline: "Plan Your Visit" },
      { type: "prose", content: proseContent },
      {
        type: "cta",
        headline: "Ready to visit?",
        description: "We can't wait to meet you!",
        showPrimaryCta: true,
        primaryCta: { label: "Get Directions", href: "/contact" },
        showSecondaryCta: false,
        variant: "primary",
      },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: update visit page content");
  const result = await completeStep(siteId, "visit-content");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

export async function saveFAQPage(
  siteId: string,
  slug: string,
  items: { question: string; answer: string }[],
): Promise<void> {
  await assertSiteAccess(siteId);
  const path = "src/content/pages/faq.md";
  const content = fm({
    title: "Frequently Asked Questions",
    description: "Find answers to common questions about what to expect when you visit.",
    template: "faq",
    draft: false,
    passwordProtected: false,
    blocks: [
      { ...SECONDARY_HERO, headline: "Frequently Asked Questions" },
      { type: "faq-accordion", items },
      {
        type: "cta",
        headline: "Still have questions?",
        description: "We'd love to hear from you.",
        showPrimaryCta: true,
        primaryCta: { label: "Contact Us", href: "/contact" },
        variant: "primary",
      },
    ],
  });
  const sha = await tryGetSha(slug, path);
  await commitFile(slug, path, content, sha, "wizard: update FAQ page content");
  const result = await completeStep(siteId, "faq-content");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── First Bulletin ───────────────────────────────────────────────────────────

export async function saveFirstBulletin(
  siteId: string,
  slug: string,
  fields: { date: string; pdfBase64: string; passwordProtected: boolean; password?: string },
): Promise<void> {
  await assertSiteAccess(siteId);

  // Upload the PDF (skip if no new PDF provided — just updating password settings)
  if (fields.pdfBase64) {
    const pdfPath = `public/bulletins/${fields.date}.pdf`;
    const pdfSha = await tryGetSha(slug, pdfPath);
    await commitBinaryFile(slug, pdfPath, fields.pdfBase64, pdfSha, "wizard: add first bulletin");
  }

  // If password-protected, update bulletins.md
  if (fields.passwordProtected && fields.password) {
    const bulletinsPath = "src/content/pages/bulletins.md";
    const bulletinsContent = fm({
      title: "Bulletins",
      description: "Weekly bulletins",
      template: "bulletins",
      draft: false,
      passwordProtected: true,
      password: fields.password,
      blocks: [
        { ...SECONDARY_HERO, headline: "Bulletins" },
        {
          type: "container",
          background: "background",
          padding: "lg",
          ratio: "1:3",
          columns: [
            { blocks: [{ type: "icon", size: "xl", color: "primary", icon: "file" }] },
            { blocks: [{ type: "bulletin-list", layout: "list", showTitle: false, showDate: true }] },
          ],
        },
        {
          type: "cta",
          variant: "default",
          headline: "Looking for something specific?",
          showDescription: true,
          showPrimaryCta: true,
          primaryCta: { label: "Contact Us", href: "/contact" },
          showSecondaryCta: false,
        },
      ],
    });
    const bulletinsSha = await tryGetSha(slug, bulletinsPath);
    await commitFile(slug, bulletinsPath, bulletinsContent, bulletinsSha, "wizard: enable bulletin password protection");
  }

  const result = await completeStep(siteId, "first-bulletin");
  if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
}

// ─── Contact Form Verification ────────────────────────────────────────────────

/**
 * Creates a CF Email Routing destination address for the given email,
 * which triggers a verification email to that address.
 * Idempotent — safe to call again if the address already exists.
 */
export async function initiateContactFormVerification(
  siteId: string,
  slug: string,
  email: string,
): Promise<{ ok: boolean; email?: string; alreadyVerified?: boolean; error?: string }> {
  await assertSiteAccess(siteId);

  if (!email) return { ok: false, error: "Please enter an email address." };

  // Persist the chosen form email so launchSite can register it with corner-apostle
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
    const check = await checkContactFormVerification(siteId, slug, email);
    return { ok: true, email, alreadyVerified: check.verified };
  }

  const errBody = await res.json().catch(() => ({}));
  console.error("CF Email Routing address creation failed:", errBody);
  return { ok: false, error: "Failed to initiate email verification." };
}

/**
 * Checks whether the site's contact email has been verified as a
 * CF Email Routing destination address.
 */
export async function checkContactFormVerification(
  siteId: string,
  slug: string,
  email: string,
): Promise<{ verified: boolean; email?: string; error?: string }> {
  await assertSiteAccess(siteId);

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

/**
 * Removes the contact form email: deletes it from CF Email Routing,
 * clears formEmail from site.config.yaml, and marks the step incomplete.
 */
export async function removeContactFormEmail(
  siteId: string,
  slug: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  await assertSiteAccess(siteId);

  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (accountId && apiToken) {
    // Look up the destination address identifier
    const listRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses?per_page=50`,
      { headers: { Authorization: `Bearer ${apiToken}` } },
    );
    if (listRes.ok) {
      const listData = await listRes.json() as { result?: { tag: string; email: string }[] };
      const address = listData.result?.find((a) => a.email === email);
      if (address) {
        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routing/addresses/${address.tag}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${apiToken}` } },
        );
      }
    }
  }

  // Clear formEmail from site config
  try {
    const { content, sha } = await getFileWithSha(slug, "src/config/site.config.yaml");
    const parsed = YAML.parse(content) as Record<string, unknown>;
    const contact = (parsed.contact ?? {}) as Record<string, unknown>;
    delete contact.formEmail;
    parsed.contact = contact;
    await commitFile(slug, "src/config/site.config.yaml", YAML.stringify(parsed, { lineWidth: 0 }), sha, "wizard: remove form email");
  } catch {
    // Config may not exist yet — fine
  }

  await uncompleteStep(siteId, "contact-form");

  return { ok: true };
}
