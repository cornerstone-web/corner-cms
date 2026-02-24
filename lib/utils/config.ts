/**
 * Utility functions to create, retrieve and update a repository configuration
 * from the DB.
 *
 * Look at the `lib/config.ts` file to understand how the config is parsed,
 * normalized and validated.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { cache } from "react";
import { Config } from "@/types/config";
import { db } from "@/db";
import { configTable } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { configVersion, parseConfig, normalizeConfig } from "@/lib/config";

// Baked platform config — parsed once at module load time.
// Used as a fallback when a repo has no DB entry (church repos using the
// platform architecture never write a .pages.yml, so they have no DB row).
const platformConfigYaml = readFileSync(
  join(process.cwd(), "lib/platform-config.yaml"),
  "utf-8"
);
const { document: platformDoc } = parseConfig(platformConfigYaml);
const platformConfigObject = normalizeConfig(platformDoc.toJSON());

const getConfig = cache(
  async (
    owner: string,
    repo: string,
    branch: string,
  ): Promise<Config | null> => {
    if (!owner || !repo || !branch) throw new Error(`Owner, repo, and branch must all be provided.`);

    const config = await db.query.configTable.findFirst({
      where: and(
        sql`lower(${configTable.owner}) = lower(${owner})`,
        sql`lower(${configTable.repo}) = lower(${repo})`,
        eq(configTable.branch, branch),
      )
    });

    if (!config) {
      // Fallback: church repos using the platform architecture have no DB entry.
      // Return the baked platform config so API routes can resolve collection
      // and media paths without requiring a .pages.yml in the church repo.
      return {
        owner: owner.toLowerCase(),
        repo: repo.toLowerCase(),
        branch,
        sha: "platform",
        version: configVersion ?? "0.0",
        object: platformConfigObject,
      };
    }

    return {
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      sha: config.sha,
      version: config.version,
      object: JSON.parse(config.object)
    }
  }
);

const saveConfig = async (
  config: Config,
): Promise<Config> => {
  const result = await db.insert(configTable).values({
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    sha: config.sha,
    version: config.version,
    object: JSON.stringify(config.object)
  });

  return config;
}

const updateConfig = async (
  config: Config,
): Promise<Config> => {
  await db.update(configTable).set({
    sha: config.sha,
    version: config.version,
    object: JSON.stringify(config.object)
  }).where(
    and(
      sql`lower(${configTable.owner}) = lower(${config.owner})`,
      sql`lower(${configTable.repo}) = lower(${config.repo})`,
      eq(configTable.branch, config.branch)
    )
  );

  return config;
}

export { getConfig, saveConfig, updateConfig };