"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { STATIC_SCOPES, type StaticScope } from "@/lib/utils/access-control";
import { cn } from "@/lib/utils";

type EntryScope = {
  scope: string;
  label: string;
};

type CollectionItem = {
  type: "file" | "dir";
  name: string;
  fields?: { title?: string; name?: string };
};

type CollectionEntriesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; entries: EntryScope[] }
  | { status: "error" };

interface ScopePickerProps {
  owner: string;
  repo: string;
  branch: string;
  selectedScopes: string[];
  onChange: (scopes: string[]) => void;
  disabled?: boolean;
}

const GROUPS: { label: string; group: StaticScope["group"] }[] = [
  { label: "Collections", group: "collection" },
  { label: "Site Config", group: "site-config" },
  { label: "Media", group: "media" },
];

export function ScopePicker({
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
      // If unchecking a collection scope, also remove all entry scopes for it
      if (scope.startsWith("collection:")) {
        const collectionName = scope.replace("collection:", "");
        for (const s of Array.from(next)) {
          if (s.startsWith(`entry:${collectionName}:`)) next.delete(s);
        }
      }
    } else {
      next.add(scope);
      // If adding a collection scope, remove individual entry scopes (superseded)
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

    if (collectionEntries[collectionName]) return; // already loaded

    setCollectionEntries(prev => ({ ...prev, [collectionName]: { status: "loading" } }));
    try {
      const res = await fetch(
        `/api/${owner}/${repo}/${encodeURIComponent(branch)}/collections/${collectionName}`
      );
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      const entries: EntryScope[] = (data.data?.contents ?? [])
        .filter((c: CollectionItem) => c.type === "file")
        .map((c: CollectionItem) => ({
          scope: `entry:${collectionName}:${c.name.replace(/\.[^.]+$/, "")}`,
          label: c.fields?.title ?? c.fields?.name ?? c.name,
        }));
      setCollectionEntries(prev => ({ ...prev, [collectionName]: { status: "loaded", entries } }));
    } catch {
      setCollectionEntries(prev => ({ ...prev, [collectionName]: { status: "error" } }));
    }
  }

  return (
    <div className="space-y-5">
      {GROUPS.map(({ label, group }) => {
        const groupScopes = STATIC_SCOPES.filter(s => s.group === group);
        return (
          <div key={group} className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            <div className="space-y-1">
              {groupScopes.map(({ scope, label: scopeLabel }) => {
                const collectionName = group === "collection" ? scope.replace("collection:", "") : null;
                const isCollectionChecked = selected.has(scope);
                const entriesState = collectionName ? (collectionEntries[collectionName] ?? { status: "idle" }) : null;
                const isExpanded = collectionName ? expandedCollections.has(collectionName) : false;

                return (
                  <div key={scope}>
                    <div className="flex items-center gap-2 py-1">
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
                        {scopeLabel}
                      </Label>
                      <span className="font-mono text-[11px] text-muted-foreground/60 hidden sm:inline">{scope}</span>
                      {collectionName && !isCollectionChecked && (
                        <button
                          type="button"
                          className="p-0.5 hover:text-foreground text-muted-foreground"
                          onClick={() => expandCollection(collectionName)}
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

                    {/* Entry-level scopes (expanded, not superseded by collection scope) */}
                    {collectionName && isExpanded && !isCollectionChecked && (
                      <div className="ml-6 mt-1 space-y-1 border-l pl-3">
                        {entriesState?.status === "loading" && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Loading entries…
                          </div>
                        )}
                        {entriesState?.status === "error" && (
                          <p className="text-xs text-destructive py-1">Failed to load entries.</p>
                        )}
                        {entriesState?.status === "loaded" && entriesState.entries.length === 0 && (
                          <p className="text-xs text-muted-foreground py-1">No entries found.</p>
                        )}
                        {entriesState?.status === "loaded" && entriesState.entries.map(entry => (
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
        );
      })}
    </div>
  );
}
