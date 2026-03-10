"use server";

import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, churchWizardStepsTable } from "@/db/schema";
import { createRepoFromTemplate, updateSiteConfig, commitFile, tryGetSha, getFileWithSha } from "@/lib/github/wizard";
import { generateNav, WizardFeatures } from "@/lib/wizard/nav-gen";
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

// ─── launchChurch ─────────────────────────────────────────────────────────────

export interface LaunchOptions {
  churchId: string;
  features: WizardFeatures;
  homeOpts: HomeGenOptions;
}

/**
 * Final wizard step:
 * 1. Commit auto-generated nav to site.config.yaml
 * 2. Commit home page blocks to src/content/pages/index.md
 * 3. Create Cloudflare Pages project
 * 4. Set church status to "active"
 * 5. Mark "launched" step complete
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

    // 1. Commit auto-generated navigation.
    // Read current site.config.yaml to pick up the giving URL committed by GivingStep,
    // since LaunchStep doesn't track it in WizardFeatures.
    let givingUrl: string | undefined;
    try {
      const { content: configYaml } = await getFileWithSha(repoName, "src/config/site.config.yaml");
      const currentConfig = YAML.parse(configYaml) as Record<string, unknown>;
      givingUrl = (currentConfig?.giving as { url?: string } | undefined)?.url;
    } catch {
      // Config not yet written — giving URL not set, proceed without it
    }
    const nav = generateNav({ ...opts.features, givingUrl });
    await updateSiteConfig(repoName, { navigation: nav }, "chore: set navigation from wizard");

    // 2. Commit home page blocks
    const blocks = generateHomeBlocks(opts.homeOpts);
    const indexPath = "src/content/pages/index.md";
    const sha = await tryGetSha(repoName, indexPath);
    // Build the YAML frontmatter blocks array
    const blocksYaml = YAML.stringify(blocks, { lineWidth: 0 })
      .split("\n")
      .filter(Boolean)
      .map((l) => "  " + l)
      .join("\n");
    const indexContent = `---\ntitle: Home\ntemplate: landing\nblocks:\n${blocksYaml}\n---\n`;
    await commitFile(repoName, indexPath, indexContent, sha, "chore: set home page blocks from wizard");

    // 3. Create Cloudflare Pages project
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
        cfPagesUrl = subdomain ? `https://${subdomain}.pages.dev` : undefined;
        await db
          .update(churchesTable)
          .set({ cfPagesProjectName, cfPagesUrl, updatedAt: new Date() })
          .where(eq(churchesTable.id, opts.churchId));
      } else {
        const errBody = await cfRes.json().catch(() => ({}));
        console.error("CF Pages project creation failed:", errBody);
        throw new Error("Failed to create Cloudflare Pages project.");
      }
    }

    // 4. Set status to active
    await db
      .update(churchesTable)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(churchesTable.id, opts.churchId));

    // 5. Mark launched step complete
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
