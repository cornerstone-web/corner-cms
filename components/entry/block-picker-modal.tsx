"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Search, Plus, ArrowLeft, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useConfig } from "@/contexts/config-context";
import { useSiteFeaturesContext } from "@/contexts/site-features-context";
import type { Field, BlockCategory } from "@/types/field";

interface BlockPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBlocks: Field[];
  onSelect: (blockName: string) => void;
}

interface CategoryGroup {
  category: BlockCategory;
  blocks: Field[];
}

const DEFAULT_CATEGORY: BlockCategory = {
  key: "_other",
  label: "Other",
  description: "Additional blocks",
};

export function BlockPickerModal({
  open,
  onOpenChange,
  availableBlocks,
  onSelect,
}: BlockPickerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPreviewBlock, setSelectedPreviewBlock] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { config } = useConfig();
  const { previewUrl: previewBaseUrl } = useSiteFeaturesContext();

  // Group blocks by category, preserving category order
  const groupedBlocks = useMemo((): CategoryGroup[] => {
    const blockCategories: BlockCategory[] = config?.object?.blockCategories ?? [];
    const groups: CategoryGroup[] = [];
    const categorized = new Set<string>();

    for (const cat of blockCategories) {
      const blocks = availableBlocks.filter((b) => b.category === cat.key);
      if (blocks.length > 0) {
        groups.push({ category: cat, blocks });
        blocks.forEach((b) => categorized.add(b.name));
      }
    }

    // Uncategorized blocks go in "Other"
    const uncategorized = availableBlocks.filter((b) => !categorized.has(b.name));
    if (uncategorized.length > 0) {
      groups.push({ category: DEFAULT_CATEGORY, blocks: uncategorized });
    }

    return groups;
  }, [availableBlocks, config]);

  // Filter blocks by search query (matches name, label, and description)
  const filteredBlocks = useMemo(() => {
    if (!searchQuery.trim()) return null; // null means show grouped view
    const q = searchQuery.toLowerCase();
    return availableBlocks.filter(
      (b) =>
        (b.label && typeof b.label === "string" && b.label.toLowerCase().includes(q)) ||
        b.name.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q)),
    );
  }, [searchQuery, availableBlocks]);

  const selectedBlock = useMemo(
    () => availableBlocks.find((b) => b.name === selectedPreviewBlock),
    [availableBlocks, selectedPreviewBlock],
  );

  const handleSelect = useCallback(
    (blockName: string) => {
      onSelect(blockName);
      // Reset state for next open
      setSearchQuery("");
      setSelectedPreviewBlock(null);
      setIframeLoaded(false);
    },
    [onSelect],
  );

  const handlePreview = useCallback((blockName: string) => {
    setSelectedPreviewBlock(blockName);
    setIframeLoaded(false);
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedPreviewBlock(null);
    setIframeLoaded(false);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setSearchQuery("");
        setSelectedPreviewBlock(null);
        setIframeLoaded(false);
      }
      onOpenChange(open);
    },
    [onOpenChange],
  );

  const previewUrl = selectedPreviewBlock && previewBaseUrl
    ? `${previewBaseUrl}/preview/${selectedPreviewBlock}`
    : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden flex flex-col",
          // Hide the auto-injected close button (dialog closes via overlay click or Escape)
          "[&>button:last-child]:hidden",
          // Mobile: full-screen
          "h-[100dvh] w-full max-w-full rounded-none sm:rounded-lg",
          // Desktop: large modal
          "sm:h-auto sm:max-h-[80vh] sm:max-w-4xl sm:w-[90vw]",
        )}
      >
        {/* Header */}
        <DialogHeader className="flex-none border-b px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Back button on mobile when preview is showing */}
            {selectedPreviewBlock && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClosePreview}
                className="sm:hidden -ml-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="flex-1 text-base">
              {selectedPreviewBlock && selectedBlock
                ? <span className="sm:hidden">{typeof selectedBlock.label === "string" ? selectedBlock.label : selectedBlock.name}</span>
                : null}
              <span className={selectedPreviewBlock ? "hidden sm:inline" : ""}>
                Add a Block
              </span>
            </DialogTitle>
            {/* Close button on mobile */}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => handleOpenChange(false)}
              className="sm:hidden -mr-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Browse and select a content block to add to the page.
          </DialogDescription>
          {/* Search - hidden on mobile when preview is showing */}
          <div className={cn(
            "relative mt-2",
            selectedPreviewBlock ? "hidden sm:block" : "",
          )}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search blocks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 min-h-0 flex">
          {/* Block list - hidden on mobile when preview is active */}
          <div
            className={cn(
              "flex-1 min-h-0",
              selectedPreviewBlock
                ? "hidden sm:block sm:w-[40%] sm:flex-none sm:border-r"
                : "w-full",
            )}
          >
            <ScrollArea className="h-full">
              <div className="p-4">
                {filteredBlocks !== null ? (
                  // Search results (flat list)
                  filteredBlocks.length > 0 ? (
                    <div className="space-y-1">
                      {filteredBlocks.map((block) => (
                        <BlockItem
                          key={block.name}
                          block={block}
                          isSelected={block.name === selectedPreviewBlock}
                          onAdd={handleSelect}
                          onPreview={previewBaseUrl ? handlePreview : undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No blocks match &ldquo;{searchQuery}&rdquo;
                    </p>
                  )
                ) : (
                  // Grouped by category
                  <div className="space-y-6">
                    {groupedBlocks.map(({ category, blocks }) => (
                      <div key={category.key}>
                        <div className="mb-2">
                          <h3 className="text-sm font-semibold">{category.label}</h3>
                          {category.description && (
                            <p className="text-xs text-muted-foreground">
                              {category.description}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1">
                          {blocks.map((block) => (
                            <BlockItem
                              key={block.name}
                              block={block}
                              isSelected={block.name === selectedPreviewBlock}
                              onAdd={handleSelect}
                              onPreview={previewBaseUrl ? handlePreview : undefined}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Preview pane - on mobile: full width, on desktop: right panel */}
          {selectedPreviewBlock && (
            <div
              className={cn(
                "flex-1 min-h-0 flex flex-col",
                // Mobile: full width
                "w-full",
                // Desktop: right panel
                "sm:w-[60%]",
              )}
            >
              {/* Desktop preview header */}
              <div className="hidden sm:flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {selectedBlock && typeof selectedBlock.label === "string"
                      ? selectedBlock.label
                      : selectedPreviewBlock}
                  </h3>
                  {selectedBlock?.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedBlock.description}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleClosePreview}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Iframe preview */}
              <div className="flex-1 min-h-0 relative bg-white">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                      <span className="text-sm">Loading preview...</span>
                    </div>
                  </div>
                )}
                {previewUrl && (
                  <iframe
                    src={previewUrl}
                    onLoad={() => setIframeLoaded(true)}
                    className={cn(
                      "w-full h-full border-0",
                      iframeLoaded ? "opacity-100" : "opacity-0",
                    )}
                    title={`${selectedPreviewBlock} preview`}
                  />
                )}
              </div>

              {/* Mobile description + add button */}
              <div className="sm:hidden flex-none border-t p-4 space-y-3">
                {selectedBlock?.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedBlock.description}
                  </p>
                )}
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => handleSelect(selectedPreviewBlock)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Block
                </Button>
              </div>

              {/* Desktop add button */}
              <div className="hidden sm:block flex-none border-t p-3">
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => handleSelect(selectedPreviewBlock)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Block
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Individual block item in the list
function BlockItem({
  block,
  isSelected,
  onAdd,
  onPreview,
}: {
  block: Field;
  isSelected: boolean;
  onAdd: (name: string) => void;
  onPreview?: (name: string) => void;
}) {
  const label = typeof block.label === "string" ? block.label : block.name;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        "hover:bg-muted/50",
        isSelected && "bg-muted",
      )}
    >
      {/* Clickable block name - opens preview (or adds if no preview available) */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => (onPreview ? onPreview(block.name) : onAdd(block.name))}
      >
        <div className="font-medium truncate">{label}</div>
        {block.description && (
          <div className="text-xs text-muted-foreground truncate">
            {block.description}
          </div>
        )}
      </button>

      {/* Quick add button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="flex-none text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(block.name);
        }}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
