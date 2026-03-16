"use server";

import { and, eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, churchWizardStepsTable } from "@/db/schema";
import { createRepoFromTemplate, updateSiteConfig, commitFile, tryGetSha, getFileWithSha, getDirectoryFileNames } from "@/lib/github/wizard";
import { applyLatestVersionToRepo } from "@/lib/actions/cornerstone-update";
import { generateNav, WizardFeatures } from "@/lib/wizard/nav-gen";
import { generateFooterSections } from "@/lib/wizard/footer-gen";
import { generateHomeBlocks, HomeGenOptions } from "@/lib/wizard/home-gen";
import YAML from "yaml";

const GITHUB_ORG = process.env.GITHUB_ORG ?? "cornerstone-web";

// ─── Auth guard ───────────────────────────────────────────────────────────────

async function assertChurchAdmin(churchId: string) {
  const { user } = await getAuth();
  if (!user) throw new Error("Not authenticated.");
  if (user.isSuperAdmin) return user;
  if (
    user.churchAssignment?.churchId === churchId &&
    user.churchAssignment.role === "church_admin"
  )
    return user;
  throw new Error("Unauthorized.");
}

// ─── initWizard ───────────────────────────────────────────────────────────────

/**
 * Called on first /setup page load.
 * Creates the GitHub repo from corner-template and stamps wizardStartedAt.
 * Idempotent — safe to call on subsequent loads (checks wizardStartedAt).
 */
export async function initWizard(
  churchId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertChurchAdmin(churchId);

    const church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.id, churchId),
    });
    if (!church) throw new Error("Church not found.");
    if (church.wizardStartedAt) return { ok: true }; // Already initialized

    const repoName = church.slug;
    await createRepoFromTemplate(repoName);

    // Set package.json name to the church slug immediately after repo creation,
    // before CF Pages ever runs npm install.
    try {
      const { content: pkgContent, sha: pkgSha } = await getFileWithSha(repoName, "package.json");
      const pkg = JSON.parse(pkgContent) as { name?: string };
      if (pkg.name !== repoName) {
        pkg.name = repoName;
        await commitFile(repoName, "package.json", JSON.stringify(pkg, null, 2) + "\n", pkgSha, "chore: set package name to church slug");
      }
    } catch (err) {
      console.error("package.json name update failed (non-fatal):", err);
    }

    await db
      .update(churchesTable)
      .set({
        wizardStartedAt: new Date(),
        githubRepoName: `${GITHUB_ORG}/${repoName}`,
        updatedAt: new Date(),
      })
      .where(eq(churchesTable.id, churchId));

    return { ok: true };
  } catch (err) {
    console.error("initWizard failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to initialize wizard.",
    };
  }
}

// ─── completeStep ─────────────────────────────────────────────────────────────

/**
 * Mark a wizard step as complete in the DB.
 * Uses onConflictDoNothing so it is safe to call multiple times for the same step.
 */
export async function completeStep(
  churchId: string,
  stepKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertChurchAdmin(churchId);
    await db
      .insert(churchWizardStepsTable)
      .values({ churchId, stepKey })
      .onConflictDoNothing();
    return { ok: true };
  } catch (err) {
    console.error("completeStep failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record step.",
    };
  }
}

export async function uncompleteStep(
  churchId: string,
  stepKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await assertChurchAdmin(churchId);
    await db
      .delete(churchWizardStepsTable)
      .where(
        and(
          eq(churchWizardStepsTable.churchId, churchId),
          eq(churchWizardStepsTable.stepKey, stepKey),
        ),
      );
    return { ok: true };
  } catch (err) {
    console.error("uncompleteStep failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to uncomplete step.",
    };
  }
}

// ─── launchChurch ─────────────────────────────────────────────────────────────

export interface LaunchOptions {
  churchId: string;
  features: WizardFeatures;
  homeOpts: HomeGenOptions;
}

/**
 * Final wizard step:
 * 1. Read site.config.yaml (givingUrl, contactEmail, serviceTimes, channelId)
 * 2. Create Cloudflare Pages project
 * 3. PATCH CF Pages env vars (including GITHUB_TOKEN for GPR)
 * 4. Commit nav config → triggers first CF Pages build
 * 5. Commit home page blocks → triggers second build
 * 6. Register with corner-apostle (non-fatal)
 * 7. Set church status to "active"
 * 8. Mark "launched" step complete
 */
export async function launchChurch(opts: LaunchOptions): Promise<{
  ok: boolean;
  cfPagesUrl?: string;
  error?: string;
}> {
  try {
    await assertChurchAdmin(opts.churchId);

    const church = await db.query.churchesTable.findFirst({
      where: eq(churchesTable.id, opts.churchId),
    });
    if (!church) throw new Error("Church not found.");

    const repoName = church.slug;

    // 1. Read current site.config.yaml for giving URL, contact email, service times, and channel ID
    let givingUrl: string | undefined;
    let contactEmail: string | undefined;
    let currentConfig: Record<string, unknown> | undefined;
    try {
      const { content: configYaml } = await getFileWithSha(repoName, "src/config/site.config.yaml");
      currentConfig = YAML.parse(configYaml) as Record<string, unknown>;
      givingUrl = (currentConfig?.giving as { url?: string } | undefined)?.url;
      contactEmail = (currentConfig?.contact as { formEmail?: string } | undefined)?.formEmail;
    } catch {
      // Config not yet written — proceed without it
    }

    const rawTimes = (currentConfig?.serviceTimes as { day?: string; time?: string; name?: string; label?: string }[] | undefined) ?? [];
    const serviceTimes = rawTimes
      .map(t => ({ time: t.time ?? "", label: t.label ?? t.name ?? t.day ?? "" }))
      .filter(t => t.time);

    const channelId = (currentConfig?.integrations as { youtubeChannelId?: string } | undefined)?.youtubeChannelId;

    // Collect marquee image paths uploaded during the wizard
    let marqueeImages: string[] = [];
    if (opts.homeOpts.photos) {
      const names = await getDirectoryFileNames(repoName, "public/uploads/marquee");
      marqueeImages = names.map(n => `/uploads/marquee/${n}`);
    }

    // 2. Create Cloudflare Pages project (before commits so builds are triggered)
    let cfPagesUrl: string | undefined;
    const cfAccountId = process.env.CF_ACCOUNT_ID;
    const cfApiToken = process.env.CF_API_TOKEN;

    if (cfAccountId && cfApiToken) {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: repoName,
            production_branch: "main",
            source: {
              type: "github",
              config: {
                owner: GITHUB_ORG,
                repo_name: repoName,
                production_branch: "main",
                pr_comments_enabled: false,
                deployments_enabled: true,
              },
            },
            build_config: {
              build_command: "npm run build",
              destination_dir: "dist",
              root_dir: "",
            },
          }),
        },
      );

      if (cfRes.ok) {
        const cfData = await cfRes.json();
        const cfPagesProjectName = cfData.result?.name as string | undefined;
        const subdomain = cfData.result?.subdomain as string | undefined;
        // subdomain already includes ".pages.dev" — do not append it again
        cfPagesUrl = subdomain ? `https://${subdomain}` : undefined;
        await db
          .update(churchesTable)
          .set({ cfPagesProjectName, cfPagesUrl, updatedAt: new Date() })
          .where(eq(churchesTable.id, opts.churchId));

        // 3. Set CF Pages env vars (including GITHUB_TOKEN so CF Pages can install @cornerstone-web/core from GPR)
        const workerUrl = process.env.CORNER_APOSTLE_URL ?? "";
        const cornerstoneApiKey = process.env.CORNERSTONE_API_KEY ?? "";
        if (cfPagesProjectName) {
          await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${cfPagesProjectName}`,
            {
              method: "PATCH",
              headers: {
                Authorization: `Bearer ${cfApiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                deployment_configs: {
                  production: {
                    env_vars: {
                      PUBLIC_SITE_KEY: { type: "plain_text", value: repoName },
                      PUBLIC_FORM_WORKER_URL: { type: "plain_text", value: workerUrl },
                      PUBLIC_CORNERSTONE_API_KEY: { type: "plain_text", value: cornerstoneApiKey },
                      GITHUB_TOKEN: { type: "plain_text", value: process.env.CF_PAGES_GITHUB_TOKEN ?? "" },
                    },
                  },
                },
              }),
            },
          ).catch((err) => console.error("CF Pages env vars PATCH failed (non-fatal):", err));
        }
      } else {
        const errBody = await cfRes.json().catch(() => ({}));
        console.error("CF Pages project creation failed:", errBody);
        throw new Error("Failed to create Cloudflare Pages project.");
      }
    }

    // Extract name/description for home hero personalization
    const siteName = (currentConfig?.name as string) ?? "";
    const siteDescription = (currentConfig?.description as string) ?? "";

    // 4. Commit auto-generated navigation + footer sections → triggers first CF Pages build
    const nav = generateNav({ ...opts.features, givingUrl });
    const footerSections = generateFooterSections({ ...opts.features, givingUrl });
    await updateSiteConfig(
      repoName,
      { navigation: nav, footer: { sections: footerSections }, previewUrl: cfPagesUrl ?? "" },
      "chore: set navigation, footer sections, and preview URL from wizard",
    );

    // 5. Commit home page blocks → triggers second CF Pages build (final state)
    const blocks = generateHomeBlocks({ ...opts.homeOpts, marqueeImages, serviceTimes, channelId, name: siteName, description: siteDescription });
    const indexPath = "src/content/pages/index.md";
    const sha = await tryGetSha(repoName, indexPath);
    const blocksYaml = YAML.stringify(blocks, { lineWidth: 0 })
      .split("\n")
      .filter(Boolean)
      .map((l) => "  " + l)
      .join("\n");
    const indexContent = `---\ntitle: Home\ntemplate: landing\nblocks:\n${blocksYaml}\n---\n`;
    await commitFile(repoName, indexPath, indexContent, sha, "chore: set home page blocks from wizard");

    // 5b. Commit personalized contact.md
    try {
      const address = (currentConfig?.contact as Record<string, unknown> | undefined)?.address as Record<string, string> | undefined ?? {};
      const phone = (currentConfig?.contact as Record<string, string> | undefined)?.phone ?? "";
      const fullAddress = [address.street, address.city, address.state, address.zip].filter(Boolean).join(", ");
      const mapsEmbedUrl = fullAddress
        ? `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`
        : "https://www.google.com/maps/embed";

      const serviceTimesLines = serviceTimes.length
        ? serviceTimes.map((t) => `\n*   ${t.label}: ${t.time}`).join("")
        : "\n*   See our website for current service times";

      const contactProseLines = [
        "## Contact",
        "",
        ...(fullAddress ? [`**Address** ${fullAddress}`, ""] : []),
        ...(phone ? [`**Phone** ${phone}`, ""] : []),
        ...(contactEmail ? [`**Email** ${contactEmail}`, ""] : []),
        "## Service Times",
        serviceTimesLines,
      ];
      const contactProseContent = contactProseLines.join("\n").trim();

      const contactPageContent = YAML.stringify({
        title: "Contact Us",
        description: "Get in touch with our church",
        template: "default",
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
            headline: "Contact Us",
            showSubheadline: false,
            showPrimaryCta: false,
            showSecondaryCta: false,
            showScrollIndicator: false,
          },
          {
            type: "container",
            background: "background",
            padding: "md",
            ratio: "2:3",
            maxWidth: "content",
            columns: [
              {
                blocks: [
                  {
                    type: "map",
                    showTitle: true,
                    title: "Come Visit Us",
                    mapEmbedUrl: mapsEmbedUrl,
                    height: "md",
                    showAddress: false,
                  },
                ],
              },
              {
                blocks: [
                  {
                    type: "prose",
                    maxWidth: "normal",
                    content: contactProseContent,
                  },
                ],
              },
            ],
          },
          {
            type: "form",
            showTitle: true,
            title: "Get in Touch",
            fields: [
              { name: "name", type: "text", label: "Name", required: true },
              { name: "email", type: "email", label: "Email", required: true },
              { name: "message", type: "textarea", label: "Message", required: true },
            ],
          },
          {
            type: "cta",
            variant: "primary",
            headline: "Ready to visit?",
            showDescription: false,
            showPrimaryCta: true,
            primaryCta: { label: "Plan Your Visit", href: "/visit" },
            showSecondaryCta: false,
          },
        ],
      }, { lineWidth: 0 });
      const contactPath = "src/content/pages/contact.md";
      const contactSha = await tryGetSha(repoName, contactPath);
      await commitFile(repoName, contactPath, `---\n${contactPageContent}---\n`, contactSha, "chore: personalize contact page from wizard");
    } catch (err) {
      console.error("Contact page personalization failed (non-fatal):", err);
    }

    // 5c. Pin @cornerstone-web/core to latest version (non-fatal)
    try {
      await applyLatestVersionToRepo(repoName);
    } catch (err) {
      console.error("cornerstone-core version update failed (non-fatal):", err);
    }

    // 6. Register church with corner-apostle via GitHub commit (non-fatal)
    const apostleRepo = process.env.CORNER_APOSTLE_REPO;
    if (apostleRepo && contactEmail && cfPagesUrl) {
      try {
        // Update registry.json
        const { content: registryRaw, sha: registrySha } =
          await getFileWithSha(apostleRepo, "src/registry.json");
        const registry = JSON.parse(registryRaw) as Record<string, {
          email: string; name: string; allowedOrigins: string[];
        }>;
        registry[repoName] = {
          email: contactEmail,
          name: church.displayName,
          allowedOrigins: [cfPagesUrl],
        };
        await commitFile(
          apostleRepo,
          "src/registry.json",
          JSON.stringify(registry, null, 2) + "\n",
          registrySha,
          `chore: register ${repoName} contact form`,
        );

        // Update wrangler.jsonc — add email to allowed_destination_addresses
        const { content: wranglerRaw, sha: wranglerSha } =
          await getFileWithSha(apostleRepo, "wrangler.jsonc");
        // Strip JSONC comments and trailing commas before parsing
        const wranglerJson = wranglerRaw
          .replace(/\/\/[^\n]*/g, "")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/,(\s*[}\]])/g, "$1");
        const wrangler = JSON.parse(wranglerJson) as {
          send_email?: { name: string; allowed_destination_addresses?: string[] }[];
        };
        const sendEmail = wrangler.send_email?.[0];
        if (sendEmail) {
          if (!sendEmail.allowed_destination_addresses) {
            sendEmail.allowed_destination_addresses = [];
          }
          if (!sendEmail.allowed_destination_addresses.includes(contactEmail)) {
            sendEmail.allowed_destination_addresses.push(contactEmail);
            await commitFile(
              apostleRepo,
              "wrangler.jsonc",
              JSON.stringify(wrangler, null, 2) + "\n",
              wranglerSha,
              `chore: add ${repoName} email to corner-apostle`,
            );
          }
        }
      } catch (err) {
        console.error("corner-apostle registration failed (non-fatal):", err);
      }
    }

    // 7. Set status to active
    await db
      .update(churchesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(churchesTable.id, opts.churchId));

    // 8. Mark launched step complete
    await completeStep(opts.churchId, "launched");

    return { ok: true, cfPagesUrl };
  } catch (err) {
    console.error("launchChurch failed:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Launch failed.",
    };
  }
}
