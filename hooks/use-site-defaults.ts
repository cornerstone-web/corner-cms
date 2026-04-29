"use client";

import { useEffect, useState } from "react";
import { useConfig } from "@/contexts/config-context";

const siteDefaultsCache = new Map<string, Record<string, unknown>>();
const inflightFetches = new Map<string, Promise<Record<string, unknown>>>();

function fetchSiteDefaults(
  owner: string,
  repo: string,
  branch: string,
): Promise<Record<string, unknown>> {
  const cacheKey = `${owner}/${repo}/${branch}`;
  const cached = siteDefaultsCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);
  const inflight = inflightFetches.get(cacheKey);
  if (inflight) return inflight;

  const promise = fetch(
    `/api/${owner}/${repo}/${encodeURIComponent(branch)}/site-config`,
  )
    .then((r) => r.json())
    .then((result) => {
      if (result.status !== "success") return {};
      const config = (result.data.config ?? {}) as Record<string, unknown>;
      // Only cache on success — failures should let the next caller retry.
      siteDefaultsCache.set(cacheKey, config);
      return config;
    })
    .catch(() => ({}) as Record<string, unknown>)
    .finally(() => {
      inflightFetches.delete(cacheKey);
    });

  inflightFetches.set(cacheKey, promise);
  return promise;
}

/**
 * Fetches the consuming repo's site.config.yaml once per (owner/repo/branch)
 * and caches it. Concurrent callers share the same in-flight request.
 * Used by entry-form add-block flows so fields with `defaultFrom` inherit
 * values from site config.
 */
export function useSiteDefaults(): Record<string, unknown> {
  const { config: repoConfig } = useConfig();
  const [siteDefaults, setSiteDefaults] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (!repoConfig) return;
    const cacheKey = `${repoConfig.owner}/${repoConfig.repo}/${repoConfig.branch}`;
    const cached = siteDefaultsCache.get(cacheKey);
    if (cached) {
      setSiteDefaults(cached);
      return;
    }
    let cancelled = false;
    fetchSiteDefaults(repoConfig.owner, repoConfig.repo, repoConfig.branch).then((config) => {
      if (!cancelled) setSiteDefaults(config);
    });
    return () => {
      cancelled = true;
    };
  }, [repoConfig]);

  return siteDefaults;
}
