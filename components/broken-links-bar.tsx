"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBrokenLinks } from "@/hooks/use-broken-links";
import { useConfig } from "@/contexts/config-context";
import { useSiteFeaturesContext } from "@/contexts/site-features-context";
import { useRepo } from "@/contexts/repo-context";
import { cn } from "@/lib/utils";

export function BrokenLinksBar() {
  const { config } = useConfig();
  const { previewUrl } = useSiteFeaturesContext();
  const { owner, repo } = useRepo();
  const { brokenLinks, loading, refresh } = useBrokenLinks();
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Only render when previewUrl is configured and there are broken links
  if (!previewUrl || loading || brokenLinks.length === 0) {
    return null;
  }

  const branch = config?.branch ?? "";
  const count = brokenLinks.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    refresh();
    // Give it a moment to start loading, then reset the icon
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 shrink-0">
      {/* Summary row — click anywhere to toggle */}
      <div
        className="flex items-center gap-2 px-4 md:px-6 h-10 text-sm cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-amber-800 dark:text-amber-200 font-medium">
          {count} broken {count === 1 ? "link" : "links"} found
        </span>
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            title="Re-scan"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </Button>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          )}
        </div>
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="px-4 md:px-6 pb-3 max-h-48 overflow-y-auto space-y-1.5">
          {brokenLinks.map((link, i) => (
            <div
              key={i}
              className="flex items-baseline gap-2 text-xs"
            >
              <span className="font-mono text-amber-900 dark:text-amber-100 shrink-0">
                {link.url}
              </span>
              <span className="text-amber-700 dark:text-amber-400 truncate flex-1">
                {link.source}
              </span>
              {link.collectionName && link.entryPath && (
                <Link
                  href={`/${owner}/${repo}/${encodeURIComponent(branch)}/collection/${encodeURIComponent(link.collectionName)}/edit/${encodeURIComponent(link.entryPath)}`}
                  className="shrink-0 text-amber-700 dark:text-amber-300 underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Edit →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
