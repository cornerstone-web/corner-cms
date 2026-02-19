"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { useConfig } from "@/contexts/config-context";

interface SiteFeaturesContextType {
  features: Record<string, boolean>;
  loading: boolean;
}

const SiteFeaturesContext = createContext<SiteFeaturesContextType>({
  features: {},
  loading: true,
});

export function useSiteFeaturesContext() {
  return useContext(SiteFeaturesContext);
}

export function SiteFeaturesProvider({ children }: { children: React.ReactNode }) {
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

  return (
    <SiteFeaturesContext.Provider value={{ features, loading }}>
      {children}
    </SiteFeaturesContext.Provider>
  );
}
