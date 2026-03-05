/**
 * Token helper functions — installation-only model.
 *
 * All GitHub API calls use the org-level GitHub App installation token.
 * Per-user GitHub OAuth tokens are no longer used (removed with Auth0 migration).
 *
 * Access control is enforced separately by verifyRepoAccess().
 */

import { cache } from "react";
import { App } from "octokit";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/db";
import { githubInstallationTokenTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { User } from "@/types/user";

// Get the installation token for any owner/repo.
// All users share the single org installation — access control is in verifyRepoAccess().
const getToken = cache(async (_user: User, owner: string, repo: string) => {
  return getInstallationToken(owner, repo);
});

// Get the GitHub App installation token, using GITHUB_APP_INSTALLATION_ID from env
// when available (org-level install), or looking up per-repo as a fallback.
const getInstallationToken = cache(async (owner: string, _repo: string) => {
  const app = new App({
    appId: process.env.GITHUB_APP_ID!,
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
  });

  // Prefer the env-configured org installation ID — avoids an extra GitHub API call.
  const envInstallationId = process.env.GITHUB_APP_INSTALLATION_ID
    ? parseInt(process.env.GITHUB_APP_INSTALLATION_ID, 10)
    : null;

  let installationId: number;

  if (envInstallationId) {
    installationId = envInstallationId;
  } else {
    // Fallback: look up installation by org
    const orgInstallation = await app.octokit.rest.apps.getOrgInstallation({ org: owner });
    installationId = orgInstallation.data.id;
  }

  // Check DB cache
  let tokenData = await db.query.githubInstallationTokenTable.findFirst({
    where: eq(githubInstallationTokenTable.installationId, installationId)
  });

  if (tokenData && Date.now() < tokenData.expiresAt.getTime() - 60_000) {
    const token = await decrypt(tokenData.ciphertext, tokenData.iv);
    if (!token) throw new Error("Installation token could not be decrypted.");
    return token;
  }

  const installationToken = await app.octokit.rest.apps.createInstallationAccessToken({
    installation_id: installationId
  });

  const { ciphertext, iv } = await encrypt(installationToken.data.token);
  const expiresAt = new Date(installationToken.data.expires_at);

  if (tokenData) {
    await db.update(githubInstallationTokenTable)
      .set({ ciphertext, iv, expiresAt })
      .where(eq(githubInstallationTokenTable.id, tokenData.id));
  } else {
    await db.insert(githubInstallationTokenTable).values({
      ciphertext,
      iv,
      installationId,
      expiresAt
    });
  }

  return installationToken.data.token;
});

export { getInstallationToken, getToken };
