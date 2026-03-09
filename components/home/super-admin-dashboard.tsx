"use client";

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
import { Building2, ExternalLink, Pencil, Plus, Settings } from "lucide-react";

type ChurchRow = {
  id: string;
  displayName: string;
  slug: string;
  githubRepoName: string;
  cfPagesUrl: string | null;
  customDomain: string | null;
  status: "provisioning" | "active" | "suspended";
  updatedAt: Date;
};

const statusVariant: Record<
  ChurchRow["status"],
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

export function SuperAdminDashboard({ churches }: { churches: ChurchRow[] }) {
  return (
    <div className="max-w-screen-lg mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="font-semibold text-lg md:text-2xl tracking-tight">
            Sites
          </h1>
          <span className="text-sm text-muted-foreground">
            ({churches.length})
          </span>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/churches/new">
            <Plus className="h-4 w-4 mr-1.5" />
            Provision New Site
          </Link>
        </Button>
      </div>

      {churches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No sites yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Provision your first site to get started.
          </p>
          <Button asChild className="mt-4" size="sm">
            <Link href="/admin/churches/new">
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
                <TableHead>Congregation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Live Site</TableHead>
                <TableHead className="hidden md:table-cell">Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {churches.map((church) => {
                const [owner, repo] = church.githubRepoName.split("/");
                return (
                  <TableRow key={church.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{church.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {church.githubRepoName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={statusVariant[church.status]}
                        className="capitalize"
                      >
                        {church.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {(church.customDomain || church.cfPagesUrl) ? (() => {
                        const url = church.customDomain ?? church.cfPagesUrl!;
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
                      {formatRelativeDate(new Date(church.updatedAt))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="ghost" size="xs">
                          <Link href={`/${owner}/${repo}`}>
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            <span className="hidden sm:inline">Edit</span>
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="xs">
                          <Link href={`/admin/churches/${church.id}`}>
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
