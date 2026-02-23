"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUploadsHealth } from "@/hooks/use-uploads-health";
import { useConfig } from "@/contexts/config-context";
import { useRepo } from "@/contexts/repo-context";
import { cn } from "@/lib/utils";

export function BrokenOrUnusedUploadsBar() {
  const { config } = useConfig();
  const { owner, repo } = useRepo();
  const { brokenRefs, unusedUploads, loading, refresh } = useUploadsHealth();

  const [refsExpanded, setRefsExpanded] = useState(false);
  const [unusedExpanded, setUnusedExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasMedia =
    Array.isArray(config?.object?.media) &&
    (config?.object?.media as any[]).length > 0;

  if (
    !hasMedia ||
    loading ||
    (brokenRefs.length === 0 && unusedUploads.length === 0)
  ) {
    return null;
  }

  const branch = config!.branch;

  const handleRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1500);
  };

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
      {/* ── Broken upload refs section (rose) ── */}
      {brokenRefs.length > 0 && (
        <>
          <div
            className="flex items-center gap-2 px-4 md:px-6 h-10 text-sm border-b border-slate-200 dark:border-slate-800 cursor-pointer select-none"
            onClick={() => setRefsExpanded((e) => !e)}
          >
            <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-rose-800 dark:text-rose-200 font-medium">
              {brokenRefs.length} broken image{" "}
              {brokenRefs.length === 1 ? "reference" : "references"}
            </span>
            <div className="flex items-center gap-1 ml-auto">
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900"
                onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                title="Re-scan"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
                />
              </Button>
              {refsExpanded ? (
                <ChevronUp className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              )}
            </div>
          </div>

          {refsExpanded && (
            <div className="px-4 md:px-6 pb-3 pt-2 max-h-48 overflow-y-auto space-y-1.5 border-b border-slate-200 dark:border-slate-800">
              {brokenRefs.map((ref, i) => (
                <div key={i} className="flex items-baseline gap-2 text-xs">
                  <span className="font-mono text-rose-900 dark:text-rose-100 shrink-0">
                    {ref.url}
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 truncate flex-1">
                    {ref.source}
                  </span>
                  {ref.collectionName && ref.entryPath && (
                    <Link
                      href={`/${owner}/${repo}/${encodeURIComponent(branch)}/collection/${encodeURIComponent(ref.collectionName)}/edit/${encodeURIComponent(ref.entryPath)}`}
                      className="shrink-0 text-rose-700 dark:text-rose-300 underline underline-offset-2 hover:text-rose-900 dark:hover:text-rose-100"
                    >
                      Edit →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Unused uploads section (amber) ── */}
      {unusedUploads.length > 0 && (
        <>
          <div
            className="flex items-center gap-2 px-4 md:px-6 h-10 text-sm cursor-pointer select-none"
            onClick={() => setUnusedExpanded((e) => !e)}
          >
            <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-amber-800 dark:text-amber-200 font-medium">
              {unusedUploads.length} unused{" "}
              {unusedUploads.length === 1 ? "upload" : "uploads"}
            </span>
            <span className="text-amber-700 dark:text-amber-400 text-xs hidden sm:inline">
              — Consider deleting unused uploads to limit available upload space
            </span>
            <div className="flex items-center gap-1 ml-auto">
              {brokenRefs.length === 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900"
                  onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
                  title="Re-scan"
                >
                  <RefreshCw
                    className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
                  />
                </Button>
              )}
              {unusedExpanded ? (
                <ChevronUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
            </div>
          </div>

          {unusedExpanded && (
            <div className="px-4 md:px-6 pb-3 pt-2 max-h-48 overflow-y-auto space-y-1.5">
              {unusedUploads.map((filePath, i) => (
                <div
                  key={i}
                  className="text-xs font-mono text-amber-900 dark:text-amber-100"
                >
                  {filePath}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
