"use client";

import { useState, useEffect } from "react";
import { useConfig } from "@/contexts/config-context";

/**
 * Shared hook that fetches feature toggles from site config.
 * Used by sidebar (repo-nav) and block picker (entry-form) to hide
 * disabled collections and their dependent blocks.
 */
export function useSiteFeatures() {
  const { config } = useConfig();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;

    fetch(
      `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config`
    )
      .then((r) => r.json())
      .then((result) => {
        if (result.status === "success" && result.data?.config?.features) {
          setFeatures(result.data.config.features);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [config]);

  return { features, loading };
}
