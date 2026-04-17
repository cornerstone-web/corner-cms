export const maxDuration = 30;

import { type NextRequest } from "next/server";
import { getAuth } from "@/lib/auth";
import { db } from "@/db";
import { sitesTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyRepoAccess } from "@/lib/utils/repoAccess";
import { handleRouteError } from "@/lib/utils/apiError";

type Range = "7d" | "30d" | "90d";

function dateRange(range: Range): { start: string; end: string } {
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  // Use tomorrow as end so CF includes today's partial-day data regardless of
  // the user's local timezone offset vs UTC. CF ignores future dates gracefully.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - days);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

const CF_GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";

async function cfQuery<T>(
  apiToken: string,
  query: string,
  variables: Record<string, string>,
): Promise<T> {
  const res = await fetch(CF_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`CF GraphQL HTTP ${res.status}`);
  const json = await res.json() as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(`CF GraphQL: ${json.errors[0].message}`);
  return json.data as T;
}

// CF GraphQL does not support object-typed variables for filter arguments, so the
// filter is interpolated as a literal. This is safe because:
//   - siteTag is written by the CF API itself (never user input)
//   - start/end are derived exclusively from the range allowlist via dateRange()
//     and formatted as YYYY-MM-DD (digits + dash only)
// Neither value can contain GraphQL syntax characters.
function buildFilter(start: string, end: string, siteTag: string): string {
  return `{ AND: [{ date_geq: "${start}" }, { date_leq: "${end}" }, { siteTag: "${siteTag}" }] }`;
}

type TsShape     = { viewer: { accounts: Array<{ rows: Array<{ count: number; sum: { visits: number }; dimensions: { date: string } }> }> } };
type PathShape   = { viewer: { accounts: Array<{ rows: Array<{ count: number; dimensions: { requestPath: string } }> }> } };
type CountryShape = { viewer: { accounts: Array<{ rows: Array<{ count: number; dimensions: { countryName: string } }> }> } };
type DeviceShape  = { viewer: { accounts: Array<{ rows: Array<{ count: number; dimensions: { deviceType: string } }> }> } };

async function queryCfAnalytics(
  accountTag: string,
  siteTag: string,
  range: Range,
  apiToken: string,
) {
  const { start, end } = dateRange(range);
  const filter = buildFilter(start, end, siteTag);
  // accountTag passed as a GraphQL variable (string type, safe)
  const vars = { accountTag };

  const accountFilter = `(filter: { accountTag: $accountTag })`;
  const rowsFilter = `filter: ${filter}`;

  // All 4 queries are independent — run in parallel.
  // Totals are derived from the time series (sum of per-day rows) to avoid the
  // limit: 1 / no-dimensions footgun where CF returns an arbitrary single bucket
  // instead of a true aggregate, causing shorter ranges to show higher counts.
  const [tsData, pathData, countryData, deviceData] = await Promise.all([
    // Time series: group by date, up to 91 rows (max range is 90d).
    // Also fetches sum.visits so we can derive total visitors without a separate query.
    cfQuery<TsShape>(apiToken, `
      query($accountTag: String!) {
        viewer {
          accounts ${accountFilter} {
            rows: rumPageloadEventsAdaptiveGroups(
              ${rowsFilter}
              limit: 91
              orderBy: [date_ASC]
            ) {
              count
              sum { visits }
              dimensions { date }
            }
          }
        }
      }
    `, vars),

    // Top pages: group by requestPath
    cfQuery<PathShape>(apiToken, `
      query($accountTag: String!) {
        viewer {
          accounts ${accountFilter} {
            rows: rumPageloadEventsAdaptiveGroups(
              ${rowsFilter}
              limit: 20
              orderBy: [count_DESC]
            ) {
              count
              dimensions { requestPath }
            }
          }
        }
      }
    `, vars),

    // Countries: group by countryName
    cfQuery<CountryShape>(apiToken, `
      query($accountTag: String!) {
        viewer {
          accounts ${accountFilter} {
            rows: rumPageloadEventsAdaptiveGroups(
              ${rowsFilter}
              limit: 20
              orderBy: [count_DESC]
            ) {
              count
              dimensions { countryName }
            }
          }
        }
      }
    `, vars),

    // Devices: group by deviceType
    cfQuery<DeviceShape>(apiToken, `
      query($accountTag: String!) {
        viewer {
          accounts ${accountFilter} {
            rows: rumPageloadEventsAdaptiveGroups(
              ${rowsFilter}
              limit: 5
              orderBy: [count_DESC]
            ) {
              count
              dimensions { deviceType }
            }
          }
        }
      }
    `, vars),
  ]);

  // Derive totals by summing per-day rows — avoids the limit:1 / no-dimensions bug.
  let pageViews = 0;
  let visitors = 0;
  const dayMap = new Map<string, number>();
  for (const row of tsData?.viewer?.accounts?.[0]?.rows ?? []) {
    pageViews += row.count;
    visitors += row.sum?.visits ?? 0;
    const d = row.dimensions.date;
    dayMap.set(d, (dayMap.get(d) ?? 0) + row.count);
  }
  const timeSeries = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pvs]) => ({ date, pageViews: pvs }));

  const pathMap = new Map<string, number>();
  for (const row of pathData?.viewer?.accounts?.[0]?.rows ?? []) {
    const p = row.dimensions.requestPath || "/";
    pathMap.set(p, (pathMap.get(p) ?? 0) + row.count);
  }
  const topPages = Array.from(pathMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([path, views]) => ({ path, views }));

  const countryMap = new Map<string, number>();
  for (const row of countryData?.viewer?.accounts?.[0]?.rows ?? []) {
    const c = row.dimensions.countryName || "Unknown";
    countryMap.set(c, (countryMap.get(c) ?? 0) + row.count);
  }
  const countries = Array.from(countryMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([country, views]) => ({ country, views }));

  const deviceMap = new Map<string, number>();
  for (const row of deviceData?.viewer?.accounts?.[0]?.rows ?? []) {
    const d = row.dimensions.deviceType || "Unknown";
    deviceMap.set(d, (deviceMap.get(d) ?? 0) + row.count);
  }
  const devices = Array.from(deviceMap.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([device, views]) => ({ device, views }));

  return { totals: { pageViews, visitors }, timeSeries, topPages, countries, devices };
}

/**
 * GET /api/[owner]/[repo]/[branch]/analytics?range=7d|30d|90d
 *
 * Returns Cloudflare Web Analytics data for the site.
 * Requires CF_ACCOUNT_ID and CF_API_TOKEN (with Account Analytics: Read scope).
 * Response is cached for 5 minutes (stale-while-revalidate 10 minutes).
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ owner: string; repo: string; branch: string }> },
): Promise<Response> {
  const params = await props.params;
  try {
    const { user } = await getAuth();
    if (!user) return new Response(null, { status: 401 });

    verifyRepoAccess(user, params.owner, params.repo);

    const cfAccountId = process.env.CF_ACCOUNT_ID;
    const cfApiToken = process.env.CF_API_TOKEN;
    if (!cfAccountId || !cfApiToken) {
      return Response.json(
        { status: "error", message: "Cloudflare credentials not configured." },
        { status: 503 },
      );
    }

    const repoName = `${params.owner}/${params.repo}`.toLowerCase();
    const site = await db.query.sitesTable.findFirst({
      where: eq(sitesTable.githubRepoName, repoName),
      columns: { cfAnalyticsSiteTag: true },
    });

    if (!site?.cfAnalyticsSiteTag) {
      return Response.json(
        { status: "error", message: "Analytics not configured for this site." },
        { status: 404 },
      );
    }

    const rawRange = request.nextUrl.searchParams.get("range") ?? "30d";
    const range: Range = ["7d", "30d", "90d"].includes(rawRange)
      ? (rawRange as Range)
      : "30d";

    const data = await queryCfAnalytics(cfAccountId, site.cfAnalyticsSiteTag, range, cfApiToken);

    return Response.json(
      { status: "success", data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
