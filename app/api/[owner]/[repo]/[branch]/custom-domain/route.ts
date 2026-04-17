import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { handleRouteError } from "@/lib/utils/apiError";
import { updateApostleOrigins } from "@/lib/actions/setup";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

function cfHeaders() {
  return {
    Authorization: `Bearer ${process.env.CF_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function normalizeDomain(raw: string): string {
  // Strip protocol, trailing slashes, and www. prefix
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

export async function GET(
  _request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> },
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const githubRepoName = `${params.owner}/${params.repo}`;

    // Access guard
    if (!user.isSuperAdmin) {
      if (!user.siteAssignment) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
      if (user.siteAssignment.githubRepoName !== githubRepoName) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
    }

    const site = await db.query.sitesTable.findFirst({
      where: and(eq(sitesTable.githubRepoName, githubRepoName), isNull(sitesTable.deletedAt)),
    });

    if (!site) return new Response(JSON.stringify({ error: "Site not found." }), { status: 404 });

    const { customDomain, cfPagesProjectName } = site;

    // Fetch live status from CF Pages API if we have enough info
    let rootStatus: string | null = null;
    let wwwStatus: string | null = null;

    if (customDomain && cfPagesProjectName && process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
      const cfRes = await fetch(
        `${CF_API_BASE}/accounts/${process.env.CF_ACCOUNT_ID}/pages/projects/${cfPagesProjectName}/domains`,
        { headers: cfHeaders() },
      ).catch(() => null);

      if (cfRes?.ok) {
        const cfData = await cfRes.json();
        const domains: Array<{ name: string; status: string }> = cfData.result ?? [];
        const rootEntry = domains.find(d => d.name === customDomain);
        const wwwEntry = domains.find(d => d.name === `www.${customDomain}`);
        rootStatus = rootEntry?.status ?? null;
        wwwStatus = wwwEntry?.status ?? null;
      }
    }

    return Response.json({
      customDomain,
      cfPagesProjectName,
      rootStatus,
      wwwStatus,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> },
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const githubRepoName = `${params.owner}/${params.repo}`;

    // Only site_admin or super_admin may set a custom domain
    if (!user.isSuperAdmin) {
      if (!user.siteAssignment) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
      if (
        user.siteAssignment.githubRepoName !== githubRepoName ||
        !user.siteAssignment.isAdmin
      ) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
    }

    const body = await request.json();
    const rawDomain = body.domain as string | undefined;

    if (!rawDomain || typeof rawDomain !== "string") {
      return new Response(JSON.stringify({ error: '"domain" is required.' }), { status: 400 });
    }

    const domain = normalizeDomain(rawDomain);

    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return new Response(JSON.stringify({ error: "Invalid domain format." }), { status: 400 });
    }

    const site = await db.query.sitesTable.findFirst({
      where: and(eq(sitesTable.githubRepoName, githubRepoName), isNull(sitesTable.deletedAt)),
    });

    if (!site) return new Response(JSON.stringify({ error: "Site not found." }), { status: 404 });
    if (!site.cfPagesProjectName) {
      return new Response(
        JSON.stringify({ error: "Cloudflare Pages project not yet configured for this site." }),
        { status: 422 },
      );
    }

    const cfAccountId = process.env.CF_ACCOUNT_ID;
    const cfApiToken = process.env.CF_API_TOKEN;

    if (!cfAccountId || !cfApiToken) {
      return new Response(JSON.stringify({ error: "Cloudflare API not configured." }), { status: 503 });
    }

    const projectName = site.cfPagesProjectName;
    const domainsUrl = `${CF_API_BASE}/accounts/${cfAccountId}/pages/projects/${projectName}/domains`;

    // Register root domain
    const rootRes = await fetch(domainsUrl, {
      method: "POST",
      headers: cfHeaders(),
      body: JSON.stringify({ name: domain }),
    });

    // Register www domain
    const wwwRes = await fetch(domainsUrl, {
      method: "POST",
      headers: cfHeaders(),
      body: JSON.stringify({ name: `www.${domain}` }),
    });

    // 409 = already registered, which is fine (idempotent)
    if (!rootRes.ok && rootRes.status !== 409) {
      const err = await rootRes.json().catch(() => ({}));
      console.error("CF Pages domain registration failed (root):", err);
      return new Response(
        JSON.stringify({ error: "Failed to register domain with Cloudflare Pages." }),
        { status: 502 },
      );
    }

    if (!wwwRes.ok && wwwRes.status !== 409) {
      const err = await wwwRes.json().catch(() => ({}));
      console.error("CF Pages domain registration failed (www):", err);
      // Non-fatal: root succeeded; continue but surface the partial failure
    }

    // Persist to DB
    await db
      .update(sitesTable)
      .set({ customDomain: domain, updatedAt: new Date() })
      .where(eq(sitesTable.id, site.id));

    // Update corner-apostle allowedOrigins (non-fatal)
    const origins = [
      ...(site.cfPagesUrl ? [site.cfPagesUrl] : []),
      `https://${domain}`,
      `https://www.${domain}`,
    ];
    await updateApostleOrigins(params.repo, origins).catch(() => null);

    return Response.json({
      customDomain: domain,
      cfPagesProjectName: projectName,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> },
) {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    const githubRepoName = `${params.owner}/${params.repo}`;

    if (!user.isSuperAdmin) {
      if (!user.siteAssignment) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
      if (
        user.siteAssignment.githubRepoName !== githubRepoName ||
        !user.siteAssignment.isAdmin
      ) {
        return new Response(JSON.stringify({ error: "Access denied." }), { status: 403 });
      }
    }

    const site = await db.query.sitesTable.findFirst({
      where: and(eq(sitesTable.githubRepoName, githubRepoName), isNull(sitesTable.deletedAt)),
    });

    if (!site) return new Response(JSON.stringify({ error: "Site not found." }), { status: 404 });

    const { customDomain, cfPagesProjectName } = site;

    if (customDomain && cfPagesProjectName && process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
      const base = `${CF_API_BASE}/accounts/${process.env.CF_ACCOUNT_ID}/pages/projects/${cfPagesProjectName}/domains`;

      // Delete root and www — fire and forget errors (domain may not exist on CF side)
      await Promise.all([
        fetch(`${base}/${encodeURIComponent(customDomain)}`, {
          method: "DELETE",
          headers: cfHeaders(),
        }).catch(() => null),
        fetch(`${base}/${encodeURIComponent(`www.${customDomain}`)}`, {
          method: "DELETE",
          headers: cfHeaders(),
        }).catch(() => null),
      ]);
    }

    await db
      .update(sitesTable)
      .set({ customDomain: null, updatedAt: new Date() })
      .where(eq(sitesTable.id, site.id));

    // Restore corner-apostle allowedOrigins to pages.dev only (non-fatal)
    await updateApostleOrigins(
      params.repo,
      site.cfPagesUrl ? [site.cfPagesUrl] : [],
    ).catch(() => null);

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleRouteError(error);
  }
}
