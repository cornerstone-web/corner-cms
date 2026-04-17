"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateSiteStatus } from "@/lib/actions/provision";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Building2, ExternalLink, Pencil } from "lucide-react";

type Site = {
  id: string;
  displayName: string;
  slug: string;
  githubRepoName: string;
  cfPagesUrl: string | null;
  cfPagesProjectName: string | null;
  customDomain: string | null;
  status: "provisioning" | "active" | "suspended";
  plan: string;
  createdAt: Date;
  updatedAt: Date;
  lastCmsEditAt: Date | null;
};

type RoleRow = {
  userId: string;
  isAdmin: boolean;
  name: string;
  email: string;
  auth0Id: string;
};

const statusVariant: Record<Site["status"], "default" | "secondary" | "destructive"> = {
  active: "default",
  provisioning: "secondary",
  suspended: "destructive",
};

export function SiteManagement({ site, users }: { site: Site; users: RoleRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [owner, repo] = site.githubRepoName.split("/");

  function handleStatusChange(status: "active" | "suspended" | "provisioning") {
    setError(null);
    startTransition(async () => {
      const result = await updateSiteStatus(site.id, status);
      if (!result.ok) {
        setError(result.error ?? "Update failed.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="max-w-screen-lg mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Building2 className="h-5 w-5 text-muted-foreground" />
        <h1 className="font-semibold text-lg md:text-2xl tracking-tight">{site.displayName}</h1>
        <Badge variant={statusVariant[site.status]} className="capitalize ml-1">
          {site.status}
        </Badge>
      </div>

      {/* Details */}
      <div className="rounded-lg border divide-y text-sm">
        <Row label="GitHub Repo">
          <a
            href={`https://github.com/${site.githubRepoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline text-muted-foreground"
          >
            {site.githubRepoName}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </Row>
        <Row label="Live Site">
          {(site.customDomain || site.cfPagesUrl) ? (() => {
            const url = site.customDomain ?? site.cfPagesUrl!;
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:underline text-muted-foreground truncate"
              >
                {url.replace(/^https?:\/\//, "")}
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            );
          })() : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>
        <Row label="Plan">
          <span className="text-muted-foreground capitalize">{site.plan}</span>
        </Row>
        <Row label="Created">
          <span className="text-muted-foreground">
            {new Date(site.createdAt).toLocaleDateString()}
          </span>
        </Row>
        <Row label="Last CMS Edit">
          <span className="text-muted-foreground">
            {site.lastCmsEditAt
              ? new Date(site.lastCmsEditAt).toLocaleDateString()
              : "Never"}
          </span>
        </Row>
        <Row label="Record Updated">
          <div className="text-right">
            <span className="text-muted-foreground">
              {new Date(site.updatedAt).toLocaleDateString()}
            </span>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Changes on: status, CF Pages project, analytics tag, or custom domain
            </p>
          </div>
        </Row>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm">
          <Link href={`/${owner}/${repo}`}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Open Editor
          </Link>
        </Button>

        {site.status !== "active" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleStatusChange("active")}
          >
            Activate
          </Button>
        )}
        {site.status === "active" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleStatusChange("suspended")}
          >
            Suspend
          </Button>
        )}
        {site.status === "suspended" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleStatusChange("provisioning")}
          >
            Reset to Provisioning
          </Button>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Users */}
      <div className="space-y-2">
        <h2 className="font-medium text-sm">Users</h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users assigned yet.</p>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="sm:hidden rounded-lg border divide-y overflow-hidden">
              {users.map((u) => (
                <div key={u.userId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{u.name || "—"}</span>
                    <Badge variant="secondary" className="capitalize shrink-0 text-xs">
                      {u.isAdmin ? "site admin" : "editor"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</div>
                </div>
              ))}
            </div>
            {/* Desktop: table */}
            <div className="hidden sm:block rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-medium">{u.name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {u.isAdmin ? "site admin" : "editor"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-xs text-muted-foreground sm:text-sm sm:shrink-0 sm:w-28">{label}</span>
      <div className="min-w-0 overflow-hidden sm:text-right">{children}</div>
    </div>
  );
}
