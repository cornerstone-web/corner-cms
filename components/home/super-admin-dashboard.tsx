"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, ChevronUp, ChevronsUpDown, ExternalLink, LayoutDashboard, Pencil, Plus, Settings } from "lucide-react";

type SiteRow = {
  id: string;
  displayName: string;
  slug: string;
  githubRepoName: string;
  cfPagesUrl: string | null;
  customDomain: string | null;
  status: "provisioning" | "active" | "suspended";
  updatedAt: Date;
  lastCmsEditAt: Date | null;
};

const statusVariant: Record<
  SiteRow["status"],
  "default" | "secondary" | "destructive"
> = {
  active: "default",
  provisioning: "secondary",
  suspended: "destructive",
};

function formatRelativeDate(date: Date): string {
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

type SortKey = "name" | "status" | "updatedAt";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<SiteRow["status"], number> = {
  active: 0,
  provisioning: 1,
  suspended: 2,
};

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="h-3.5 w-3.5 ml-1" />
    : <ChevronDown className="h-3.5 w-3.5 ml-1" />;
}

export function SuperAdminDashboard({ sites }: { sites: SiteRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    return [...sites].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.displayName.localeCompare(b.displayName);
      } else if (sortKey === "status") {
        cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      } else if (sortKey === "updatedAt") {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sites, sortKey, sortDir]);

  return (
    <div className="max-w-screen-lg mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold text-lg md:text-2xl tracking-tight">
            Sites
          </h1>
          <span className="text-sm text-muted-foreground">
            ({sites.length})
          </span>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/sites/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Provision New Site
          </Link>
        </Button>
      </div>

      {sites.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No sites yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Provision your first site to get started.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href="/admin/sites/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Provision New Site
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("name")}
                  >
                    Site
                    <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("status")}
                  >
                    Status
                    <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="hidden sm:table-cell">Live Site</TableHead>
                <TableHead className="hidden md:table-cell">
                  <button
                    type="button"
                    className="flex items-center hover:text-foreground transition-colors"
                    onClick={() => toggleSort("updatedAt")}
                  >
                    Last Updated
                    <SortIcon col="updatedAt" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((site) => {
                const [owner, repo] = site.githubRepoName.split("/");
                return (
                  <TableRow key={site.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{site.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {site.githubRepoName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {site.status === "provisioning" && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                          Awaiting Setup
                        </span>
                      )}
                      {site.status === "active" && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
                          Active
                        </span>
                      )}
                      {site.status === "suspended" && (
                        <Badge variant="destructive">
                          Suspended
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(site.customDomain || site.cfPagesUrl) ? (() => {
                        const url = site.customDomain ?? site.cfPagesUrl!;
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs hover:underline text-muted-foreground truncate max-w-[180px]"
                          >
                            {url.replace(/^https?:\/\//, "")}
                            <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        );
                      })() : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {site.lastCmsEditAt
                        ? formatRelativeDate(new Date(site.lastCmsEditAt))
                        : <span className="text-muted-foreground/50">—</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="xs">
                          <Link href={`/admin/sites/${site.id}/portal`}>
                            <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
                            <span className="hidden sm:inline">Portal</span>
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="xs">
                          <Link href={`/${owner}/${repo}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="xs">
                          <Link href={`/admin/sites/${site.id}`}>
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            <span className="hidden sm:inline">Manage</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
