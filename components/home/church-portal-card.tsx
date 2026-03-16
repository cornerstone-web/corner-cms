"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChurchAssignment } from "@/types/user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  Settings2,
} from "lucide-react";
import type { VersionStatus } from "@/lib/actions/cornerstone-update";
import { applyLatestVersion } from "@/lib/actions/cornerstone-update";

export function ChurchPortalCard({
  assignment,
  status,
  versionStatus,
}: {
  assignment: ChurchAssignment;
  status?: string;
  versionStatus?: VersionStatus;
}) {
  const isProvisioning = status === "provisioning";
  const [owner, repo] = assignment.githubRepoName.split("/");
  const editorHref = `/${owner}/${repo}`;

  // Poll build status when the site is active and has a CF Pages URL
  const shouldPoll =
    !isProvisioning && !!assignment.cfPagesUrl && !!assignment.churchId;
  const [buildStatus, setBuildStatus] = useState<
    "checking" | "building" | "success" | "failure"
  >(shouldPoll ? "checking" : "success");
  const [updateState, setUpdateState] = useState<"idle" | "updating" | "done" | "error">("idle");
  const isUpdating = updateState === "updating";
  const showUpdateBanner = versionStatus?.needsUpdate && updateState === "idle";

  async function handleUpdate() {
    setUpdateState("updating");
    try {
      const result = await applyLatestVersion(assignment.churchId);
      setUpdateState(result.ok ? "done" : "error");
    } catch {
      setUpdateState("error");
    }
  }

  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(
          `/api/setup/build-status?churchId=${assignment.churchId}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "success") {
          setBuildStatus("success");
          return;
        }
        if (data.status === "failure") {
          setBuildStatus("failure");
          return;
        }
        setBuildStatus("building");
      } catch {
        if (cancelled) return;
        setBuildStatus("building");
      }
      if (!cancelled) setTimeout(poll, 10000);
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [shouldPoll, assignment.churchId]);

  const siteUrl = assignment.cfPagesUrl;

  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl">
                {assignment.displayName}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {assignment.role === "church_admin" ? "Church Admin" : "Editor"}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {!isProvisioning && siteUrl && (
          <CardContent className="space-y-3">
            {buildStatus === "success" ? (
              <>
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Live site</span>
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 font-medium hover:underline text-xs truncate max-w-[200px]"
                  >
                    {siteUrl.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
                {showUpdateBanner && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm space-y-2">
                    <div>
                      <p className="font-medium text-amber-900 dark:text-amber-200 text-xs">
                        Update available — Cornerstone Core {versionStatus.latest}
                      </p>
                      <p className="text-amber-700 dark:text-amber-400 text-xs mt-0.5">
                        Your site is on {versionStatus.current}. Updating triggers a rebuild.
                      </p>
                    </div>
                    <button
                      onClick={handleUpdate}
                      disabled={isUpdating}
                      className="flex items-center gap-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                    >
                      {isUpdating ? (
                        <><Loader2 className="h-3 w-3 animate-spin" /> Updating…</>
                      ) : (
                        <><RefreshCw className="h-3 w-3" /> Update now</>
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
              </>
            ) : buildStatus === "failure" ? (
              <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Live site</span>
                <span className="text-destructive text-xs font-medium">
                  Build failed — contact support
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Live site</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Building…
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full animate-pulse"
                    style={{ width: "60%" }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Your site is being built. This usually takes 2–3 minutes.
                </p>
              </div>
            )}
          </CardContent>
        )}

        {isProvisioning && (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your site is being set up. Complete the setup wizard to configure
              and launch it.
            </p>
          </CardContent>
        )}

        {buildStatus !== "building" && buildStatus !== "checking" && (
          <CardFooter>
            {isProvisioning ? (
              <Button asChild className="w-full">
                <Link href="/setup">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Continue Setup
                </Link>
              </Button>
            ) : (
              <Button asChild className="w-full">
                <Link href={editorHref}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Open Editor
                </Link>
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
