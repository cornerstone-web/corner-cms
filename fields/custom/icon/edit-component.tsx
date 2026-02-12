"use client";

import { forwardRef, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { icons } from "lucide-react";
import type { LucideProps } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronsUpDown, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers: PascalCase <-> kebab-case
// ---------------------------------------------------------------------------

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join("");
}

// ---------------------------------------------------------------------------
// Pre-compute a searchable list of icon entries (name + component).
// The `icons` object from lucide-react maps PascalCase names to components.
// We build this once at module level so it's shared across all instances.
// ---------------------------------------------------------------------------

type IconEntry = {
  /** PascalCase component name, e.g. "MapPin" */
  componentName: string;
  /** kebab-case storage key, e.g. "map-pin" */
  kebab: string;
  /** Lowercase search target, e.g. "mappin" (stripped hyphens for fuzzy) */
  searchTarget: string;
};

const ICON_ENTRIES: IconEntry[] = Object.keys(icons)
  .sort()
  .map((componentName) => {
    const kebab = toKebabCase(componentName);
    return {
      componentName,
      kebab,
      searchTarget: kebab.replace(/-/g, " "),
    };
  });

const MAX_VISIBLE = 200;

// ---------------------------------------------------------------------------
// Render a single icon by its PascalCase component name
// ---------------------------------------------------------------------------

function LucideIcon({
  name,
  ...props
}: { name: string } & Omit<LucideProps, "ref">) {
  const IconComponent = icons[name as keyof typeof icons];
  if (!IconComponent) return null;
  return <IconComponent {...props} />;
}

// ---------------------------------------------------------------------------
// EditComponent — Searchable icon picker popover
// ---------------------------------------------------------------------------

const EditComponent = forwardRef((props: any, ref: any) => {
  const { value, field, onChange, disabled } = props;

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the search input when the popover opens
  useEffect(() => {
    if (open) {
      // Small delay to let the popover render before focusing
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Derive the PascalCase component name from the stored kebab value
  const selectedComponentName = useMemo(() => {
    if (!value) return null;
    const pascal = toPascalCase(value);
    // Verify it exists in the icons map
    return icons[pascal as keyof typeof icons] ? pascal : null;
  }, [value]);

  // Filter icons by search term, capped for performance
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ICON_ENTRIES.slice(0, MAX_VISIBLE);
    const query = search.toLowerCase().trim();
    const results: IconEntry[] = [];
    for (const entry of ICON_ENTRIES) {
      if (entry.searchTarget.includes(query) || entry.kebab.includes(query)) {
        results.push(entry);
        if (results.length >= MAX_VISIBLE) break;
      }
    }
    return results;
  }, [search]);

  const handleSelect = useCallback(
    (kebab: string) => {
      onChange(kebab);
      setOpen(false);
      setSearch("");
    },
    [onChange],
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setSearch("");
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          {selectedComponentName ? (
            <span className="flex items-center gap-2 truncate">
              <LucideIcon name={selectedComponentName} className="h-4 w-4 shrink-0" />
              <span className="truncate">{value}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select an icon...</span>
          )}
          <span className="flex items-center gap-1 shrink-0 ml-2">
            {value && !field.required && (
              <span
                role="button"
                tabIndex={0}
                className="rounded-sm opacity-50 hover:opacity-100"
                onClick={handleClear}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") handleClear(e as any);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[340px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            placeholder="Search icons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <ScrollArea className="h-[280px]">
          {filteredIcons.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No icons found.
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1 p-2">
              {filteredIcons.map((entry) => (
                <button
                  key={entry.componentName}
                  type="button"
                  title={entry.kebab}
                  onClick={() => handleSelect(entry.kebab)}
                  className={`
                    flex items-center justify-center rounded-md p-2
                    hover:bg-accent hover:text-accent-foreground
                    transition-colors cursor-pointer
                    ${value === entry.kebab
                      ? "bg-accent text-accent-foreground ring-1 ring-ring"
                      : ""
                    }
                  `}
                >
                  <LucideIcon name={entry.componentName} className="h-5 w-5" />
                </button>
              ))}
            </div>
          )}
          {!search.trim() && ICON_ENTRIES.length > MAX_VISIBLE && (
            <p className="px-3 pb-2 text-xs text-muted-foreground text-center">
              Type to search all {ICON_ENTRIES.length} icons
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});

EditComponent.displayName = "IconEditComponent";

export { EditComponent };
