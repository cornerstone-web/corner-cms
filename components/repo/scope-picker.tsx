"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { STATIC_SCOPES } from "@/lib/utils/access-control";
import { cn } from "@/lib/utils";

type EntryScope = {
  scope: string;
  label: string;
};

type CollectionEntriesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; entries: EntryScope[] }
  | { status: "error" };

export type ConfigCollection = {
  name: string;
  label: string;
};

interface ScopePickerProps {
  collections: ConfigCollection[];
  owner: string;
  repo: string;
  branch: string;
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
}

const STATIC_GROUPS: { label: string; group: "site-config" | "media" }[] = [
  { label: "Site Config", group: "site-config" },
  { label: "Media", group: "media" },
];

export function ScopePicker({
  collections,
  owner,
  repo,
  branch,
  selectedScopes,
  onChange,
  disabled,
}: ScopePickerProps) {
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [collectionEntries, setCollectionEntries] = useState<Record<string, CollectionEntriesState>>({});

  const selected = new Set(selectedScopes);

  function toggle(scope: string) {
    const next = new Set(selected);
    if (next.has(scope)) {
      next.delete(scope);
      if (scope.startsWith("collection:")) {
        const collectionName = scope.replace("collection:", "");
        for (const s of Array.from(next)) {
          if (s.startsWith(`entry:${collectionName}:`)) next.delete(s);
        }
      }
    } else {
      next.add(scope);
      if (scope.startsWith("collection:")) {
        const collectionName = scope.replace("collection:", "");
        for (const s of Array.from(next)) {
          if (s.startsWith(`entry:${collectionName}:`)) next.delete(s);
        }
      }
    }
    onChange(Array.from(next));
  }

  async function expandCollection(collectionName: string) {
    const isExpanded = expandedCollections.has(collectionName);
    if (isExpanded) {
      setExpandedCollections(prev => {
        const n = new Set(prev);
        n.delete(collectionName);
        return n;
      });
      return;
    }

    if (collectionEntries[collectionName]?.status === "loading") return;

    setExpandedCollections(prev => new Set([...prev, collectionName]));

    // Only skip if already successfully loaded — allow retry after error
    if (collectionEntries[collectionName]?.status === "loaded") return;

    setCollectionEntries(prev => ({ ...prev, [collectionName]: { status: "loading" } }));
    try {
      const res = await fetch(
        `/api/${owner}/${repo}/${encodeURIComponent(branch)}/collections/${collectionName}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const entries: EntryScope[] = (data.data?.contents ?? [])
        .filter((c: { type: string }) => c.type === "file")
        .map((c: { type: string; name: string; fields?: { title?: string; name?: string } }) => ({
          scope: `entry:${collectionName}:${c.name.replace(/\.[^.]+$/, "")}`,
          label: c.fields?.title ?? c.fields?.name ?? c.name,
        }));
      setCollectionEntries(prev => ({ ...prev, [collectionName]: { status: "loaded", entries } }));
    } catch {
      setCollectionEntries(prev => ({ ...prev, [collectionName]: { status: "error" } }));
    }
  }

  function renderScopeRow(scope: string, label: string) {
    return (
      <div className="flex items-center gap-2 py-1" key={scope}>
        <input
          type="checkbox"
          id={scope}
          checked={selected.has(scope)}
          onChange={() => toggle(scope)}
          disabled={disabled}
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
        />
        <Label
          htmlFor={scope}
          className={cn("flex-1 cursor-pointer font-normal", disabled && "cursor-not-allowed opacity-50")}
        >
          {label}
        </Label>
        <span className="font-mono text-[11px] text-muted-foreground/60 hidden sm:inline">{scope}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Collections — derived from church's .pages.yml via collections prop */}
      {collections.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Collections</p>
          <div className="space-y-1">
            {collections.map(({ name, label }) => {
              const scope = `collection:${name}`;
              const isCollectionChecked = selected.has(scope);
              const entriesState = collectionEntries[name] ?? { status: "idle" };
              const isExpanded = expandedCollections.has(name);

              return (
                <div key={scope}>
                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id={scope}
                      checked={isCollectionChecked}
                      onChange={() => toggle(scope)}
                      disabled={disabled}
                      className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
                    />
                    <Label
                      htmlFor={scope}
                      className={cn("flex-1 cursor-pointer font-normal", disabled && "cursor-not-allowed opacity-50")}
                    >
                      {label}
                    </Label>
                    <span className="font-mono text-[11px] text-muted-foreground/60 hidden sm:inline">{scope}</span>
                    {!isCollectionChecked && (
                      <button
                        type="button"
                        className="p-0.5 hover:text-foreground text-muted-foreground"
                        onClick={() => expandCollection(name)}
                        disabled={disabled}
                        title={isExpanded ? "Collapse entries" : "Expand individual entries"}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronRight className="h-3.5 w-3.5" />
                        }
                      </button>
                    )}
                  </div>

                  {isExpanded && !isCollectionChecked && (
                    <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                      {entriesState.status === "loading" && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading entries…
                        </div>
                      )}
                      {entriesState.status === "error" && (
                        <p className="text-xs text-destructive py-1">Failed to load entries.</p>
                      )}
                      {entriesState.status === "loaded" && entriesState.entries.length === 0 && (
                        <p className="text-xs text-muted-foreground py-1">No entries found.</p>
                      )}
                      {entriesState.status === "loaded" && entriesState.entries.map(entry => (
                        <div key={entry.scope} className="flex items-center gap-2 py-0.5">
                          <input
                            type="checkbox"
                            id={entry.scope}
                            checked={selected.has(entry.scope)}
                            onChange={() => toggle(entry.scope)}
                            disabled={disabled}
                            className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
                          />
                          <Label
                            htmlFor={entry.scope}
                            className={cn("flex-1 cursor-pointer font-normal text-sm", disabled && "cursor-not-allowed opacity-50")}
                          >
                            {entry.label}
                          </Label>
                          <span className="font-mono text-[11px] text-muted-foreground/60 hidden sm:inline">
                            {entry.scope}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Static groups — site-config and media (platform constants) */}
      {STATIC_GROUPS.map(({ label, group }) => {
        const groupScopes = STATIC_SCOPES.filter(s => s.group === group);
        return (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <div className="space-y-1">
              {groupScopes.map(({ scope, label: scopeLabel }) => renderScopeRow(scope, scopeLabel))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
