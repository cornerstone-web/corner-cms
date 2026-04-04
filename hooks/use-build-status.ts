"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

export type BuildStatus = "checking" | "building" | "success" | "failure";

interface UseBuildStatusResult {
  buildStatus: BuildStatus;
  consecutiveFailures: number;
  triggerRebuildWatch: () => void;
  /** Payload to POST to /api/setup/retry-build, or null if no target is resolved. */
  retryPayload: { churchId: string } | { repo: string } | null;
}

/**
 * Polls the build-status API every 10 seconds.
 *
 * When churchId is provided, polls by churchId. Otherwise, reads owner/repo
 * from URL params (editor context) and polls by repo.
 *
 * consecutiveFailures increments each time "failure" is returned and resets
 * when a new build is detected (building state reached).
 *
 * triggerRebuildWatch() — call after triggering a new build (version update,
 * retry, etc.) to immediately show the building indicator and resume polling.
 * Sets a "waiting for new build" flag so a stale "success" from the previous
 * build doesn't prematurely stop the poll loop.
 */
export function useBuildStatus(churchId?: string): UseBuildStatusResult {
  const params = useParams() as { owner?: string; repo?: string } | null;

  // Resolve the build target — used for both polling and retry
  const retryPayload: { churchId: string } | { repo: string } | null = churchId
    ? { churchId }
    : params?.owner && params?.repo
    ? { repo: `${params.owner}/${params.repo}` }
    : null;

  const apiQuery = retryPayload
    ? "churchId" in retryPayload
      ? `churchId=${encodeURIComponent(retryPayload.churchId)}`
      : `repo=${encodeURIComponent(retryPayload.repo)}`
    : null;

  const shouldPoll = !!apiQuery;

  const [buildStatus, setBuildStatus] = useState<BuildStatus>(
    shouldPoll ? "checking" : "success",
  );
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [rebuildTrigger, setRebuildTrigger] = useState(0);

  // Prevents a stale "success" (from the previous build) from stopping the
  // poll loop right after a new build has been triggered.
  const waitingForNewBuild = useRef(false);

  const triggerRebuildWatch = useCallback(() => {
    waitingForNewBuild.current = true;
    setBuildStatus("checking");
    setRebuildTrigger((t) => t + 1);
  }, []);

  // Restart polling whenever a file is committed (save button, site-config save)
  useEffect(() => {
    if (!shouldPoll) return;
    function handleFileSaved() {
      triggerRebuildWatch();
    }
    window.addEventListener("cornerstone:filesaved", handleFileSaved);
    return () => window.removeEventListener("cornerstone:filesaved", handleFileSaved);
  }, [shouldPoll, triggerRebuildWatch]);

  useEffect(() => {
    if (!shouldPoll || !apiQuery) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/setup/build-status?${apiQuery}`);
        if (cancelled) return;
        if (!res.ok) {
          if (!cancelled) timer = setTimeout(poll, 10000);
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "building") {
          // New build is underway — clear the waiting flag and reset failure streak
          waitingForNewBuild.current = false;
          setConsecutiveFailures(0);
          setBuildStatus("building");
        } else if (data.status === "success") {
          if (waitingForNewBuild.current) {
            // Previous build's success — the new build hasn't registered yet
            if (!cancelled) timer = setTimeout(poll, 10000);
            return;
          }
          setBuildStatus("success");
          return; // stop polling
        } else if (data.status === "failure") {
          waitingForNewBuild.current = false;
          setConsecutiveFailures(data.consecutiveFailures ?? 1);
          setBuildStatus("failure");
          return; // stop polling
        }
      } catch {
        if (cancelled) return;
      }
      if (!cancelled) timer = setTimeout(poll, 10000);
    }

    poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [shouldPoll, apiQuery, rebuildTrigger]);

  return { buildStatus, consecutiveFailures, triggerRebuildWatch, retryPayload };
}
