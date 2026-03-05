"use server";

/**
 * Provision a new church:
 * 1. Fork template repo into the org
 * 2. Insert churches DB record
 * 3. Create CF Pages project (if CF env vars present)
 * 4. Create Auth0 user + password-change invite ticket
 * 5. Insert users + user_church_roles DB records
 */

import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { churchesTable, usersTable, userChurchRolesTable } from "@/db/schema";
import { getInstallationToken } from "@/lib/token";
import { createOctokitInstance } from "@/lib/utils/octokit";

export type ProvisionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; churchId: string };

async function getAuth0ManagementToken(): Promise<string> {
  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AUTH0_MANAGEMENT_CLIENT_ID,
      client_secret: process.env.AUTH0_MANAGEMENT_CLIENT_SECRET,
      audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Auth0 management token error: ${data.error_description ?? res.status}`);
  return data.access_token as string;
}

export async function provisionChurch(
  _prev: ProvisionState,
  formData: FormData,
): Promise<ProvisionState> {
  const { user } = await getAuth();
  if (!user?.isSuperAdmin) return { status: "error", message: "Unauthorized." };

  const displayName = (formData.get("displayName") as string | null)?.trim() ?? "";
  const slug = (formData.get("slug") as string | null)?.trim().toLowerCase() ?? "";
  const adminEmail = (formData.get("adminEmail") as string | null)?.trim().toLowerCase() ?? "";
  const adminName = (formData.get("adminName") as string | null)?.trim() ?? "";

  if (!displayName || !slug || !adminEmail || !adminName) {
    return { status: "error", message: "All fields are required." };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return {
      status: "error",
      message: "Slug must contain only lowercase letters, numbers, and hyphens, and must not start or end with a hyphen.",
    };
  }

  const org = process.env.GITHUB_ORG ?? "cornerstone-web";
  const templateRepoName = process.env.GITHUB_TEMPLATE_REPO ?? "template-repo";
  const githubRepoName = `${org}/${slug}`;

  try {
    // 1. Fork the template repo
    const token = await getInstallationToken(org, templateRepoName);
    const octokit = createOctokitInstance(token);

    await octokit.rest.repos.createFork({
      owner: org,
      repo: templateRepoName,
      organization: org,
      name: slug,
      default_branch_only: true,
    });

    // 2. Insert church record
    const [church] = await db
      .insert(churchesTable)
      .values({ githubRepoName, slug, displayName, status: "provisioning" })
      .returning({ id: churchesTable.id });

    // 3. Create CF Pages project (optional — requires CF_ACCOUNT_ID + CF_API_TOKEN)
    const cfAccountId = process.env.CF_ACCOUNT_ID;
    const cfApiToken = process.env.CF_API_TOKEN;
    if (cfAccountId && cfApiToken) {
      try {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfApiToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: slug,
              production_branch: "main",
              source: {
                type: "github",
                config: {
                  owner: org,
                  repo_name: slug,
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
          const cfPagesUrl = subdomain ? `https://${subdomain}.pages.dev` : undefined;
          await db
            .update(churchesTable)
            .set({ cfPagesProjectName, cfPagesUrl })
            .where(eq(churchesTable.id, church.id));
        } else {
          const errBody = await cfRes.json();
          console.error("CF Pages project creation failed (non-fatal):", errBody);
        }
      } catch (cfErr) {
        console.error("CF Pages creation error (non-fatal):", cfErr);
      }
    }

    // 4. Create Auth0 user + invite ticket
    let auth0UserId: string | undefined;
    try {
      const mgmtToken = await getAuth0ManagementToken();

      const createUserRes = await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/users`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection: "Username-Password-Authentication",
          email: adminEmail,
          name: adminName,
          // Random password — the invite ticket forces a reset, so this is never used
          password: `${crypto.randomUUID()}Aa1!`,
          email_verified: false,
          blocked: false,
        }),
      });

      if (createUserRes.ok) {
        const auth0User = await createUserRes.json();
        auth0UserId = auth0User.user_id as string;
      } else {
        const errBody = await createUserRes.json();
        if (errBody.statusCode === 409) {
          // User exists — look up by email
          const searchRes = await fetch(
            `https://${process.env.AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(adminEmail)}`,
            { headers: { Authorization: `Bearer ${mgmtToken}` } },
          );
          if (searchRes.ok) {
            const existing = await searchRes.json();
            auth0UserId = existing[0]?.user_id as string | undefined;
          }
        } else {
          console.error("Auth0 user creation failed (non-fatal):", errBody);
        }
      }

      // Generate password-change (invite) ticket
      if (auth0UserId) {
        await fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2/tickets/password-change`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${mgmtToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: auth0UserId,
            result_url: process.env.APP_BASE_URL ?? "/",
            ttl_sec: 604800, // 7 days
            mark_email_as_verified: true,
          }),
        });
      }
    } catch (auth0Err) {
      console.error("Auth0 provisioning failed (non-fatal):", auth0Err);
    }

    // 5. Insert user + role into DB
    if (auth0UserId) {
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.auth0Id, auth0UserId),
      });
      const dbUserId = existing?.id ?? (
        await db
          .insert(usersTable)
          .values({ auth0Id: auth0UserId, email: adminEmail, name: adminName })
          .returning({ id: usersTable.id })
      )[0].id;

      await db.insert(userChurchRolesTable).values({
        userId: dbUserId,
        churchId: church.id,
        role: "church_admin",
      });
    }

    return { status: "success", churchId: church.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    console.error("provisionChurch failed:", err);
    return { status: "error", message };
  }
}

export async function updateChurchStatus(
  churchId: string,
  status: "active" | "suspended" | "provisioning",
): Promise<{ ok: boolean; error?: string }> {
  const { user } = await getAuth();
  if (!user?.isSuperAdmin) return { ok: false, error: "Unauthorized." };

  try {
    await db
      .update(churchesTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(churchesTable.id, churchId));
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Update failed." };
  }
}
