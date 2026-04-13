"use client";

import { useState } from "react";
import Link from "next/link";
import { ChurchAssignment } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  ChevronDown,
  Globe,
  Loader2,
  Pencil,
  RefreshCw,
  Settings2,
} from "lucide-react";
import type { VersionStatus } from "@/lib/actions/cornerstone-update";
import { applyLatestVersion } from "@/lib/actions/cornerstone-update";
import { BulletinUploadCard } from "@/components/home/bulletin-upload-card";
import { useBuildStatus } from "@/hooks/use-build-status";

export function ChurchPortalCard({
  assignment,
  status,
  versionStatus,
  bulletinsEnabled,
  customDomain,
}: {
  assignment: ChurchAssignment;
  status?: string;
  versionStatus?: VersionStatus;
  bulletinsEnabled?: boolean;
  customDomain?: string | null;
}) {
  const isProvisioning = status === "provisioning";
  const [owner, repo] = assignment.githubRepoName.split("/");
  const editorHref = `/${owner}/${repo}`;

  // Prefer custom domain, fall back to CF Pages URL
  const rawSiteUrl = customDomain
    ? customDomain.startsWith("http")
      ? customDomain
      : `https://${customDomain}`
    : (assignment.cfPagesUrl ?? null);

  const churchId =
    !isProvisioning && !!assignment.cfPagesUrl ? assignment.churchId : undefined;
  const { buildStatus, triggerRebuildWatch } = useBuildStatus(churchId);

  const [updateState, setUpdateState] = useState<
    "idle" | "updating" | "done" | "error"
  >("idle");
  const [quickActionsOpen, setQuickActionsOpen] = useState(true);
  const isUpdating = updateState === "updating";
  const showUpdateBanner = versionStatus?.needsUpdate && updateState === "idle";

  async function handleUpdate() {
    setUpdateState("updating");
    try {
      const result = await applyLatestVersion(assignment.churchId);
      if (result.ok) {
        setUpdateState("done");
        triggerRebuildWatch();
      } else {
        setUpdateState("error");
      }
    } catch {
      setUpdateState("error");
    }
  }

  const isReady = buildStatus === "success" && !isProvisioning;
  const isBuilding = buildStatus === "building" || buildStatus === "checking";
  const showBulletinCard = bulletinsEnabled && isReady;
  const hasQuickActions = showBulletinCard;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto w-full">
      {/* Hero card */}
      <Card className="w-full">
        <CardContent className="pt-8 pb-6 px-6 space-y-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-primary/10 p-3 shrink-0">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold leading-tight">
                {assignment.displayName}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {assignment.isAdmin ? "Church Admin" : "Editor"}
              </p>
            </div>
          </div>

          {/* Build progress */}
          {!isProvisioning && isBuilding && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Building your site — this usually takes 2–3 minutes.
              </div>
              <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full animate-pulse"
                  style={{ width: "60%" }}
                />
              </div>
            </div>
          )}

          {/* Build failure */}
          {buildStatus === "failure" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Last build failed — contact support.
            </div>
          )}

          {/* Version update banner */}
          {showUpdateBanner && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 space-y-2">
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200 text-xs">
                  Update available — Cornerstone Core {versionStatus.latest}
                </p>
                <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                  Your site is on {versionStatus.current}. Updating triggers a
                  rebuild.
                </p>
              </div>
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2 hover:no-underline disabled:opacity-50"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Updating…
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3" /> Update now
                  </>
                )}
              </button>
            </div>
          )}
          {updateState === "done" && (
            <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 px-3 py-2 text-xs text-green-800 dark:text-green-300">
              Updated to {versionStatus?.latest} — rebuild triggered.
            </div>
          )}
          {updateState === "error" && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Update failed. Try again later or contact support.
            </div>
          )}

          {/* Provisioning message */}
          {isProvisioning && (
            <p className="text-sm text-muted-foreground">
              Your site is being set up. Complete the setup wizard to configure
              and launch it.
            </p>
          )}

          {/* Primary actions */}
          <div className="flex gap-3">
            {isProvisioning ? (
              <Button asChild className="flex-1 sm:flex-none sm:min-w-40">
                <Link href="/setup">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Continue Setup
                </Link>
              </Button>
            ) : (
              <>
                {rawSiteUrl && (
                  <Button
                    variant="outline"
                    asChild
                    className="flex-1 sm:flex-none sm:min-w-40"
                    disabled={isBuilding}
                  >
                    <a
                      href={rawSiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="h-4 w-4 mr-2" />
                      Visit Site
                    </a>
                  </Button>
                )}
                <Button
                  asChild
                  className="flex-1 sm:flex-none sm:min-w-40"
                  disabled={isBuilding}
                >
                  <Link href={editorHref}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Open Editor
                  </Link>
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {hasQuickActions && (
        <section>
          <button
            onClick={() => setQuickActionsOpen((o) => !o)}
            className="flex items-center gap-1.5 mb-3 group"
          >
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Quick Actions
            </h2>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                quickActionsOpen ? "rotate-0" : "-rotate-90"
              }`}
            />
          </button>
          {quickActionsOpen && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {showBulletinCard && (
                <BulletinUploadCard
                  owner={owner}
                  repoName={repo}
                  branch="main"
                  viewAllHref={`/${owner}/${repo}/main/media?category=bulletins`}
                />
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
