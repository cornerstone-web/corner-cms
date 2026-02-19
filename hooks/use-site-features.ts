"use client";

import { useSiteFeaturesContext } from "@/contexts/site-features-context";

/**
 * Reads feature toggles from SiteFeaturesContext.
 * The fetch is performed once by SiteFeaturesProvider in RepoLayout.
 */
export function useSiteFeatures() {
  return useSiteFeaturesContext();
}
