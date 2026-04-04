"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { BarChart3, Globe, Monitor, Smartphone, Tablet, Users } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Range = "7d" | "30d" | "90d";

interface AnalyticsData {
  totals: { pageViews: number; visitors: number };
  timeSeries: Array<{ date: string; pageViews: number }>;
  topPages: Array<{ path: string; views: number }>;
  countries: Array<{ country: string; views: number }>;
  devices: Array<{ device: string; views: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateStr: string): string {
  // Use timeZone: "UTC" so YYYY-MM-DD strings display the correct calendar day
  // regardless of the user's local timezone offset.
  return new Date(dateStr + "T00:00:00Z").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg p-5 flex items-start gap-4">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div>
        <p className="text-3xl font-bold tracking-tight">{fmt(value)}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function BarChartViz({ data }: { data: Array<{ date: string; pageViews: number }> }) {
  if (!data.length) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        No data for this period.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.pageViews), 1);
  // Show at most 30 bars to avoid crowding
  const visible = data.length > 30 ? data.slice(-30) : data;

  return (
    <div className="mt-4">
      <div className="flex items-end gap-[2px] h-32">
        {visible.map((d) => {
          const pct = (d.pageViews / max) * 100;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end group relative"
              title={`${formatDate(d.date)}: ${d.pageViews.toLocaleString()} views`}
            >
              <div
                className="w-full bg-primary/80 rounded-sm group-hover:bg-primary transition-colors"
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1.5">
        <span className="text-xs text-muted-foreground">{formatDate(visible[0].date)}</span>
        <span className="text-xs text-muted-foreground">{formatDate(visible[visible.length - 1].date)}</span>
      </div>
    </div>
  );
}

function TopPagesTable({ pages }: { pages: Array<{ path: string; views: number }> }) {
  if (!pages.length) {
    return <p className="text-sm text-muted-foreground py-4">No page data yet.</p>;
  }

  const max = pages[0].views;
  return (
    <div className="space-y-2 mt-2">
      {pages.map(({ path, views }) => (
        <div key={path} className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <p className="text-sm font-mono truncate text-foreground">{path}</p>
            <div
              className="mt-1 h-1.5 rounded-full bg-primary/20 relative overflow-hidden"
              title={`${views.toLocaleString()} views`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
                style={{ width: `${(views / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">{fmt(views)}</span>
        </div>
      ))}
    </div>
  );
}

function CountryList({ countries }: { countries: Array<{ country: string; views: number }> }) {
  if (!countries.length) return <p className="text-sm text-muted-foreground py-4">No data yet.</p>;
  const max = countries[0].views;
  return (
    <div className="space-y-2 mt-2">
      {countries.map(({ country, views }) => (
        <div key={country} className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <p className="text-sm truncate">{country}</p>
            <div className="mt-1 h-1.5 rounded-full bg-primary/20 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-primary/60 rounded-full"
                style={{ width: `${(views / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">{fmt(views)}</span>
        </div>
      ))}
    </div>
  );
}

function deviceIcon(device: string) {
  const lower = device.toLowerCase();
  if (lower.includes("mobile") || lower.includes("phone")) return <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />;
  if (lower.includes("tablet")) return <Tablet className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Monitor className="h-3.5 w-3.5 text-muted-foreground" />;
}

function DevicePills({ devices }: { devices: Array<{ device: string; views: number }> }) {
  if (!devices.length) return <p className="text-sm text-muted-foreground py-4">No data yet.</p>;
  const total = devices.reduce((s, d) => s + d.views, 0);
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {devices.map(({ device, views }) => {
        const pct = total > 0 ? Math.round((views / total) * 100) : 0;
        return (
          <div key={device} className="border rounded-lg px-3 py-2 text-sm flex items-center gap-2">
            {deviceIcon(device)}
            <span className="font-medium">{device}</span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const params = useParams<{ owner: string; repo: string; branch: string }>();
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "unconfigured" | "ok">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async (r: Range) => {
    setStatus("loading");
    try {
      const res = await fetch(
        `/api/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}/analytics?range=${r}`,
      );
      const json = await res.json() as { status: string; data?: AnalyticsData; message?: string };
      if (res.status === 404) {
        setStatus("unconfigured");
      } else if (!res.ok || json.status !== "success") {
        setErrorMsg(json.message ?? "Failed to load analytics.");
        setStatus("error");
      } else {
        setData(json.data!);
        setStatus("ok");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }, [params.owner, params.repo, params.branch]);

  useEffect(() => { load(range); }, [load, range]);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Powered by Cloudflare Web Analytics — privacy-friendly, no cookies.
          </p>
        </div>
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="7d">7d</TabsTrigger>
            <TabsTrigger value="30d">30d</TabsTrigger>
            <TabsTrigger value="90d">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {status === "unconfigured" && (
        <div className="border rounded-lg p-8 text-center space-y-2">
          <BarChart3 className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="font-medium">Analytics not configured</p>
          <p className="text-sm text-muted-foreground">
            Analytics is set up automatically when a church site is launched.
            For existing sites, add the <code className="text-xs bg-muted px-1 py-0.5 rounded">PUBLIC_CF_ANALYTICS_TOKEN</code> environment
            variable in the Cloudflare Pages dashboard.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {(status === "loading" || status === "ok") && (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard
              label="Page views"
              value={data?.totals.pageViews ?? 0}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <MetricCard
              label="Unique visitors"
              value={data?.totals.visitors ?? 0}
              icon={<Users className="h-5 w-5" />}
            />
          </div>

          {/* Page views over time */}
          <div className="border rounded-lg p-5">
            <h2 className="text-sm font-semibold">Page views over time</h2>
            {status === "loading" ? (
              <div className="h-40 flex items-center justify-center">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <BarChartViz data={data?.timeSeries ?? []} />
            )}
          </div>

          {/* Top pages + breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-5">
              <h2 className="text-sm font-semibold">Top pages</h2>
              {status === "loading" ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <TopPagesTable pages={data?.topPages ?? []} />
              )}
            </div>
            <div className="border rounded-lg p-5">
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Countries
              </h2>
              {status === "loading" ? (
                <div className="h-20 flex items-center justify-center">
                  <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <CountryList countries={data?.countries ?? []} />
              )}
            </div>
          </div>

          {/* Device split */}
          <div className="border rounded-lg p-5">
            <h2 className="text-sm font-semibold">Devices</h2>
            {status === "loading" ? (
              <div className="h-12 flex items-center justify-center">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <DevicePills devices={data?.devices ?? []} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
