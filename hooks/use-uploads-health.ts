"use client";

import { useState, useEffect, useCallback } from "react";
import { useConfig } from "@/contexts/config-context";
import { useParams } from "next/navigation";
import type { UploadIssue } from "@/app/api/[owner]/[repo]/[branch]/uploads-health/route";

export type { UploadIssue };

interface UploadsHealthData {
  brokenRefs: UploadIssue[];
  unusedUploads: string[];
  scannedAt: string;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Module-level cache — shared across all hook instances, keyed by owner/repo/branch
let cache: { key: string; data: UploadsHealthData | null; fetchedAt: number } = {
  key: "",
  data: null,
  fetchedAt: 0,
};
let pendingPromise: Promise<UploadsHealthData | null> | null = null;

function getCacheKey(owner: string, repo: string, branch: string) {
  return `${owner}/${repo}/${branch}`;
}

function isCacheValid(key: string): boolean {
  return (
    cache.key === key &&
    cache.data !== null &&
    Date.now() - cache.fetchedAt < CACHE_TTL
  );
}

export function useUploadsHealth() {
  const { config } = useConfig();
  const params = useParams() as {
    owner: string;
    repo: string;
    branch: string;
  };

  const [data, setData] = useState<UploadsHealthData | null>(null);
  const [loading, setLoading] = useState(false);

  const hasMedia =
    Array.isArray(config?.object?.media) &&
    (config?.object?.media as any[]).length > 0;

  const cacheKey =
    params.owner && params.repo && params.branch
      ? getCacheKey(params.owner, params.repo, params.branch)
      : null;

  const fetchData = useCallback(
    async (force = false) => {
      if (!cacheKey || !hasMedia) return;

      // Return from cache if valid and not forcing
      if (!force && isCacheValid(cacheKey)) {
        setData(cache.data);
        return;
      }

      // If there's an in-flight request for the same key, wait for it
      if (!force && pendingPromise && cache.key === cacheKey) {
        setLoading(true);
        const result = await pendingPromise;
        setData(result);
        setLoading(false);
        return;
      }

      // Start a new fetch
      setLoading(true);
      cache = { key: cacheKey, data: null, fetchedAt: 0 };

      const url = `/api/${params.owner}/${params.repo}/${encodeURIComponent(params.branch)}/uploads-health`;

      pendingPromise = fetch(url)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch uploads health");
          return res.json();
        })
        .then((json) => {
          if (json.status !== "success") throw new Error(json.message);
          const result: UploadsHealthData = json.data;
          cache = { key: cacheKey, data: result, fetchedAt: Date.now() };
          return result;
        })
        .catch((err) => {
          console.warn("Could not check uploads health:", err);
          cache = { key: cacheKey, data: null, fetchedAt: Date.now() };
          return null;
        })
        .finally(() => {
          pendingPromise = null;
        });

      const result = await pendingPromise;
      setData(result);
      setLoading(false);
    },
    [cacheKey, hasMedia, params.owner, params.repo, params.branch],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refresh = useCallback(() => {
    if (cacheKey) {
      cache = { key: cacheKey, data: null, fetchedAt: 0 };
    }
    fetchData(true);
  }, [cacheKey, fetchData]);

  return {
    brokenRefs: data?.brokenRefs ?? [],
    unusedUploads: data?.unusedUploads ?? [],
    loading,
    refresh,
  };
}
