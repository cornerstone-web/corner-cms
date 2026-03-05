"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateChurchStatus } from "@/lib/actions/provision";
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

type Church = {
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
};

type RoleRow = {
  userId: string;
  role: "church_admin" | "editor";
  name: string;
  email: string;
  auth0Id: string;
};

const statusVariant: Record<Church["status"], "default" | "secondary" | "destructive"> = {
  active: "default",
  provisioning: "secondary",
  suspended: "destructive",
};

export function ChurchManagement({ church, users }: { church: Church; users: RoleRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [owner, repo] = church.githubRepoName.split("/");

  function handleStatusChange(status: "active" | "suspended" | "provisioning") {
    setError(null);
    startTransition(async () => {
      const result = await updateChurchStatus(church.id, status);
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
        <h1 className="font-semibold text-lg md:text-2xl tracking-tight">{church.displayName}</h1>
        <Badge variant={statusVariant[church.status]} className="capitalize ml-1">
          {church.status}
        </Badge>
      </div>

      {/* Details */}
      <div className="rounded-lg border divide-y text-sm">
        <Row label="GitHub Repo">
          <a
            href={`https://github.com/${church.githubRepoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:underline text-muted-foreground"
          >
            {church.githubRepoName}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </Row>
        <Row label="Deployed URL">
          {church.cfPagesUrl ? (
            <a
              href={church.cfPagesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:underline text-muted-foreground"
            >
              {church.cfPagesUrl}
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>
        {church.customDomain && (
          <Row label="Custom Domain">
            <span className="text-muted-foreground">{church.customDomain}</span>
          </Row>
        )}
        <Row label="Plan">
          <span className="text-muted-foreground capitalize">{church.plan}</span>
        </Row>
        <Row label="Created">
          <span className="text-muted-foreground">
            {new Date(church.createdAt).toLocaleDateString()}
          </span>
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

        {church.status !== "active" && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => handleStatusChange("active")}
          >
            Activate
          </Button>
        )}
        {church.status === "active" && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleStatusChange("suspended")}
          >
            Suspend
          </Button>
        )}
        {church.status === "suspended" && (
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
          <div className="rounded-lg border overflow-hidden">
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
                        {u.role.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-muted-foreground shrink-0 w-32">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}
