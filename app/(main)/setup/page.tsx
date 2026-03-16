import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import YAML from "yaml";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, churchWizardStepsTable } from "@/db/schema";
import { initWizard } from "@/lib/actions/setup";
import { getFileWithSha, getFileDownloadUrl, getFirstFileFrontmatter, getAllFilesFrontmatter, getDirectoryImageUrls, getDirectoryAllFileNames } from "@/lib/github/wizard";
import WizardShell from "@/components/setup/WizardShell";

export default async function SetupPage() {
  const { user } = await getAuth();
  if (!user) return redirect("/auth/login");

  // Super admins don't go through the wizard
  if (user.isSuperAdmin) return redirect("/");

  // Must have a church assignment to be here
  if (!user.churchAssignment) return redirect("/");

  const churchId = user.churchAssignment.churchId;

  const church = await db.query.churchesTable.findFirst({
    where: eq(churchesTable.id, churchId),
  });

  if (!church) return redirect("/");

  // Wizard already completed — send them home
  if (church.status === "active") return redirect("/");

  // First visit: kick off repo creation and stamp wizardStartedAt
  if (church.wizardStartedAt === null) {
    await initWizard(churchId);
  }

  // Load completed steps for this church
  const completedStepRows = await db.query.churchWizardStepsTable.findMany({
    where: eq(churchWizardStepsTable.churchId, churchId),
    columns: { stepKey: true },
  });
  const completedSteps = new Set(completedStepRows.map((r) => r.stepKey));

  // Load current site config to pre-populate completed steps
  let initialConfig: Record<string, unknown> = {};
  try {
    const { content } = await getFileWithSha(church.slug, "src/config/site.config.yaml");
    initialConfig = YAML.parse(content) as Record<string, unknown>;
  } catch {
    // Config not yet written (first visit) — steps will use empty defaults
  }

  // Fetch authenticated download URLs for already-uploaded branding assets
  // and first-content frontmatter for completed content steps
  const [logoUrl, heroUrl, faviconUrl, firstSeries, firstSermon, firstEvent, firstArticle, firstMinistries, firstStaff, marqueePhotos, firstLeaders, firstBulletinData, aboutPageData, beliefsPageData, visitPageData, faqPageData] = await Promise.all([
    completedSteps.has("logo") ? getFileDownloadUrl(church.slug, "public/images/logo.png") : Promise.resolve(null),
    completedSteps.has("hero") ? getFileDownloadUrl(church.slug, "public/uploads/hero.jpg") : Promise.resolve(null),
    completedSteps.has("favicon") ? getFileDownloadUrl(church.slug, "public/favicon.svg") : Promise.resolve(null),
    completedSteps.has("first-series") ? getFirstFileFrontmatter(church.slug, "src/content/series") : Promise.resolve(null),
    completedSteps.has("first-sermon") ? getFirstFileFrontmatter(church.slug, "src/content/sermons") : Promise.resolve(null),
    completedSteps.has("first-event") ? getFirstFileFrontmatter(church.slug, "src/content/events") : Promise.resolve(null),
    completedSteps.has("first-article") ? getFirstFileFrontmatter(church.slug, "src/content/articles") : Promise.resolve(null),
    completedSteps.has("first-ministry") ? getAllFilesFrontmatter(church.slug, "src/content/ministries") : Promise.resolve([]),
    completedSteps.has("first-staff") ? getAllFilesFrontmatter(church.slug, "src/content/staff").then(async (members) => {
      return Promise.all(members.map(async (m) => {
        const photoPath = m.photo as string | undefined;
        if (!photoPath) return m;
        const url = await getFileDownloadUrl(church.slug, `public${photoPath}`);
        return { ...m, photoUrl: url ?? undefined };
      }));
    }) : Promise.resolve([]),
    completedSteps.has("photos") ? getDirectoryImageUrls(church.slug, "public/uploads/marquee") : Promise.resolve([]),
    completedSteps.has("first-leaders") ? (async () => {
      try {
        const { content } = await getFileWithSha(church.slug, "src/content/pages/leadership.md");
        const match = content.match(/^---\n([\s\S]*?)\n---/);
        if (!match) return [];
        const pageFm = YAML.parse(match[1]) as Record<string, unknown>;
        const blocks = (pageFm.blocks as Record<string, unknown>[] | undefined) ?? [];
        const people = blocks
          .filter(b => b.type === "team-grid")
          .flatMap(grid => (grid.people as Record<string, unknown>[] | undefined) ?? [])
          .map(p => ({
            name: p.name as string ?? "",
            role: p.subtitle as string ?? "",
            photo: p.image as string | undefined,
          }));
        return Promise.all(people.map(async (p) => {
          if (!p.photo) return p;
          const url = await getFileDownloadUrl(church.slug, `public${p.photo}`);
          return { ...p, photoUrl: url ?? undefined, existingPhotoPath: p.photo };
        }));
      } catch {
        return [];
      }
    })() : Promise.resolve([]),
    // Fetch existing bulletin info (date from filename, password from bulletins.md)
    (async () => {
      try {
        const names = await getDirectoryAllFileNames(church.slug, "public/bulletins");
        const pdfName = names.find(n => n.endsWith(".pdf"));
        if (!pdfName) return null;
        const date = pdfName.replace(".pdf", "");
        // Check bulletins.md for password protection
        try {
          const { content } = await getFileWithSha(church.slug, "src/content/pages/bulletins.md");
          const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
          if (fmMatch) {
            const pageFm = YAML.parse(fmMatch[1]) as Record<string, unknown>;
            return { date, passwordProtected: Boolean(pageFm.passwordProtected), password: pageFm.password as string | undefined };
          }
        } catch { /* bulletins.md not accessible */ }
        return { date, passwordProtected: false };
      } catch { return null; }
    })(),
    (async () => {
      try {
        const { content } = await getFileWithSha(church.slug, "src/content/pages/about.md");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;
        const pageFm = YAML.parse(fmMatch[1]) as Record<string, unknown>;
        const blocks = (pageFm.blocks as Record<string, unknown>[] | undefined) ?? [];
        return (blocks.find(b => b.type === "prose") as Record<string, unknown> | undefined)?.content as string | undefined ?? null;
      } catch { return null; }
    })(),
    (async () => {
      try {
        const { content } = await getFileWithSha(church.slug, "src/content/pages/beliefs.md");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;
        const pageFm = YAML.parse(fmMatch[1]) as Record<string, unknown>;
        const blocks = (pageFm.blocks as Record<string, unknown>[] | undefined) ?? [];
        return (blocks.find(b => b.type === "prose") as Record<string, unknown> | undefined)?.content as string | undefined ?? null;
      } catch { return null; }
    })(),
    (async () => {
      try {
        const { content } = await getFileWithSha(church.slug, "src/content/pages/visit.md");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;
        const pageFm = YAML.parse(fmMatch[1]) as Record<string, unknown>;
        const blocks = (pageFm.blocks as Record<string, unknown>[] | undefined) ?? [];
        return (blocks.find(b => b.type === "prose") as Record<string, unknown> | undefined)?.content as string | undefined ?? null;
      } catch { return null; }
    })(),
    (async () => {
      try {
        const { content } = await getFileWithSha(church.slug, "src/content/pages/faq.md");
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) return null;
        const pageFm = YAML.parse(fmMatch[1]) as Record<string, unknown>;
        const blocks = (pageFm.blocks as Record<string, unknown>[] | undefined) ?? [];
        const faqBlock = blocks.find(b => b.type === "faq-accordion") as Record<string, unknown> | undefined;
        return faqBlock?.items as { question: string; answer: string }[] | undefined ?? null;
      } catch { return null; }
    })(),
  ]);

  return (
    <WizardShell
      church={{ id: church.id, displayName: church.displayName, slug: church.slug }}
      completedStepsArray={[...completedSteps]}
      initialConfig={initialConfig}
      initialLogoUrl={logoUrl ?? undefined}
      initialHeroUrl={heroUrl ?? undefined}
      initialFaviconUrl={faviconUrl ?? undefined}
      userEmail={user.email ?? undefined}
      initialFirstSeries={firstSeries ?? undefined}
      initialFirstSermon={firstSermon ?? undefined}
      initialFirstEvent={firstEvent ?? undefined}
      initialFirstArticle={firstArticle ?? undefined}
      initialFirstMinistries={firstMinistries.length > 0 ? firstMinistries : undefined}
      initialFirstStaff={firstStaff.length > 0 ? firstStaff : undefined}
      initialFirstLeaders={firstLeaders.length > 0 ? firstLeaders : undefined}
      initialMarqueePhotos={marqueePhotos.length > 0 ? marqueePhotos : undefined}
      initialFirstBulletin={firstBulletinData ?? undefined}
      initialAboutProse={aboutPageData ?? undefined}
      initialBeliefsProse={beliefsPageData ?? undefined}
      initialVisitProse={visitPageData ?? undefined}
      initialFaqItems={faqPageData ?? undefined}
    />
  );
}
