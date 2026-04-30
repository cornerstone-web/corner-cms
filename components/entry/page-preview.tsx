"use client";

import { useEffect, useRef, useState, useMemo, useCallback, forwardRef, useImperativeHandle } from "react";
import { useConfig } from "@/contexts/config-context";
import { getSchemaByName } from "@/lib/schema";
import {
  getPreviewOrigin,
  transformImagePaths,
  PreviewToolbar,
  PreviewFrame,
  IFrameWrapper,
  ExpandedPreviewModal,
  CollapsiblePreviewSection,
} from "./preview/shared";

interface CollectionDependency {
  name: string;
  limit?: number | string;
}

export interface PagePreviewHandle {
  reload: () => void;
  openNewTab: () => void;
}

interface PagePreviewProps {
  blocks: Array<Record<string, unknown>>;
  blockKey: string;
  previewBaseUrl: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  entryContext?: { collection: string; slug: string };
  // Full-panel mode: renders just the iframe filling available height
  fullPanel?: boolean;
  onLoadedChange?: (loaded: boolean) => void;
}

// Transform collection API response to format expected by preview blocks
function transformCollectionData(
  collectionName: string,
  apiData: {
    contents: Array<{
      name: string;
      path: string;
      fields: Record<string, unknown>;
    }>;
  },
): Array<{ slug: string; data: Record<string, unknown> }> {
  return apiData.contents
    .filter((item) => item.fields) // Only include items with parsed fields
    .map((item) => ({
      slug: item.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      data: item.fields,
    }));
}

const PagePreviewInner = (
  {
    blocks,
    blockKey,
    previewBaseUrl,
    isCollapsed,
    onToggleCollapse,
    entryContext,
    fullPanel = false,
    onLoadedChange,
  }: PagePreviewProps,
  ref: React.Ref<PagePreviewHandle>
) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(fullPanel); // full-panel always renders
  const [key, setKey] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [collectionData, setCollectionData] = useState<
    Record<string, unknown[]>
  >({});
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const { config } = useConfig();

  // Notify parent when loaded state changes (used by parent toolbar)
  useEffect(() => {
    onLoadedChange?.(isLoaded);
  }, [isLoaded, onLoadedChange]);

  // For portal rendering
  useEffect(() => {
    setMounted(true);
  }, []);

  // Get all unique collection dependencies from all blocks on the page
  const allCollections = useMemo((): CollectionDependency[] => {
    if (!config?.object?.components || !blocks) return [];

    const collectionsMap = new Map<string, CollectionDependency>();

    blocks.forEach((block) => {
      if (!block) return;
      const blockType = (block[blockKey] as string)?.replace(/_/g, "-");
      if (!blockType) return;

      // Find the component definition for this block type
      const componentName =
        blockType
          .split("-")
          .map((part, i) =>
            i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
          )
          .join("") + "Block";

      const componentDef = config.object.components[componentName];
      const collections: CollectionDependency[] =
        componentDef?.collections || [];

      collections.forEach((dep) => {
        // Use the largest limit if same collection is requested by multiple blocks
        const existing = collectionsMap.get(dep.name);
        if (!existing) {
          collectionsMap.set(dep.name, { ...dep });
        } else if (dep.limit) {
          const newLimit =
            typeof dep.limit === "string"
              ? (block[dep.limit] as number) || 10
              : dep.limit;
          const existingLimit =
            typeof existing.limit === "number" ? existing.limit : 10;
          if (newLimit > existingLimit) {
            collectionsMap.set(dep.name, { name: dep.name, limit: newLimit });
          }
        }
      });
    });

    return Array.from(collectionsMap.values());
  }, [config, blocks, blockKey]);

  // Fetch collection data for all blocks
  const fetchCollections = useCallback(async () => {
    if (!config || allCollections.length === 0) return;

    setCollectionsLoading(true);
    const newCollectionData: Record<string, unknown[]> = {};

    try {
      await Promise.all(
        allCollections.map(async (dep) => {
          try {
            const collectionSchema = getSchemaByName(config.object, dep.name);
            const collectionPath = collectionSchema?.path || "";
            const response = await fetch(
              `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/collections/${dep.name}?path=${encodeURIComponent(collectionPath)}`,
            );
            if (!response.ok) return;

            const data = await response.json();
            if (data.status === "success" && data.data?.contents) {
              let items = transformCollectionData(dep.name, data.data);

              // Apply limit if specified (use the maximum across all blocks)
              if (dep.limit && typeof dep.limit === "number") {
                items = items.slice(0, dep.limit);
              }

              newCollectionData[dep.name] = items;
            }
          } catch (err) {
            console.warn(`Failed to fetch collection "${dep.name}":`, err);
          }
        }),
      );

      setCollectionData(newCollectionData);
    } finally {
      setCollectionsLoading(false);
    }
  }, [config, allCollections]);

  // Fetch collections when preview opens
  useEffect(() => {
    if (hasEverOpened && allCollections.length > 0) {
      fetchCollections();
    }
  }, [hasEverOpened, fetchCollections, allCollections.length]);

  // Transform data for sending to preview
  // Serialize on every render to detect mutations (react-hook-form mutates in place)
  const blocksKey = JSON.stringify(blocks);
  const transformedBlocks = useMemo(
    () => blocks.filter((block) => block !== null).map((block) => transformImagePaths(block)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- blocksKey is the serialized blocks, intentionally used to detect object mutations
    [blocksKey],
  );

  // Store initial data for iframe URL (stable - doesn't change on edits)
  const initialDataRef = useRef({ blocks: transformedBlocks, blockKey });
  const initialDataParam = useMemo(
    () => encodeURIComponent(JSON.stringify(initialDataRef.current)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key triggers recomputation on manual refresh; ref.current is intentionally not tracked
    [key],
  );

  // Filter collection data based on entry context (e.g., series entry → only its sermons)
  const filteredCollectionData = useMemo(() => {
    if (!entryContext?.collection || !entryContext?.slug) return collectionData;
    if (entryContext.collection === "series" && collectionData.sermons) {
      return {
        ...collectionData,
        sermons: (
          collectionData.sermons as Array<{
            slug: string;
            data: Record<string, unknown>;
          }>
        ).filter((sermon) => sermon.data?.series === entryContext.slug),
      };
    }
    return collectionData;
  }, [collectionData, entryContext]);

  // Preview URLs
  const basePreviewUrl = `${previewBaseUrl}/preview/page`;
  const iframeUrl = `${basePreviewUrl}?data=${initialDataParam}`;
  // Restrict postMessage to the church site's origin so editor data isn't
  // broadcast cross-origin if the iframe ever navigates away.
  const previewOrigin = useMemo(() => getPreviewOrigin(previewBaseUrl), [previewBaseUrl]);

  // Send data to iframe for live updates via postMessage
  useEffect(() => {
    if (isLoaded && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "UPDATE_PAGE_PREVIEW",
          blocks: transformedBlocks,
          blockKey,
          collections: filteredCollectionData,
          entryContext,
        },
        previewOrigin,
      );
    }
  }, [transformedBlocks, blockKey, filteredCollectionData, isLoaded, entryContext, previewOrigin]);

  // Handle iframe load
  const handleLoad = () => {
    setIsLoaded(true);
    // Small delay ensures PreviewPageWrapper's useEffect has registered the listener
    setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: "UPDATE_PAGE_PREVIEW",
            blocks: transformedBlocks,
            blockKey,
            collections: filteredCollectionData,
            entryContext,
          },
          previewOrigin,
        );
      }
    }, 300);
  };

  // Reload iframe with fresh data
  const handleReload = useCallback(() => {
    initialDataRef.current = { blocks: transformedBlocks, blockKey };
    setIsLoaded(false);
    setKey((k) => k + 1);
    // Re-fetch collections on reload
    if (allCollections.length > 0) {
      fetchCollections();
    }
  }, [transformedBlocks, blockKey, allCollections, fetchCollections]);

  // Open preview in new tab with current data
  const handleOpenNewTab = useCallback(() => {
    const currentDataParam = encodeURIComponent(
      JSON.stringify({ blocks: transformedBlocks, blockKey }),
    );
    window.open(`${basePreviewUrl}?data=${currentDataParam}`, "_blank");
  }, [transformedBlocks, blockKey, basePreviewUrl]);

  // Expose controls to parent via ref (used by full-panel toolbar in entry-form)
  useImperativeHandle(ref, () => ({
    reload: handleReload,
    openNewTab: handleOpenNewTab,
  }), [handleReload, handleOpenNewTab]);

  // Handle collapse/expand toggle
  const handleToggleCollapse = () => {
    const willOpen = isCollapsed;
    onToggleCollapse();
    if (willOpen && !hasEverOpened) {
      setHasEverOpened(true);
      // Update initial data when first opening
      initialDataRef.current = { blocks: transformedBlocks, blockKey };
      setKey((k) => k + 1);
    }
  };

  const blockCount = blocks.length;

  // Header with page info
  const headerControls = (
    <div className="flex items-center justify-between px-3 py-2 bg-background/80 backdrop-blur-sm border-b">
      <span className="text-sm font-medium text-muted-foreground">
        Page Preview ({blockCount} {blockCount === 1 ? "block" : "blocks"})
      </span>
      <PreviewToolbar
        onReload={handleReload}
        onOpenNewTab={handleOpenNewTab}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        isExpanded={isExpanded}
        isLoaded={isLoaded}
      />
    </div>
  );

  // The iframe content - only render if hasEverOpened
  const iframeContent = hasEverOpened ? (
    <IFrameWrapper
      url={iframeUrl}
      title="Full page preview"
      onLoad={handleLoad}
      isLoaded={isLoaded}
      iframeRef={iframeRef}
      refreshKey={key}
    />
  ) : null;

  // Full-panel mode: fills available height, no toolbar/collapsible (toolbar is in entry-form header)
  if (fullPanel) {
    return (
      <div className="w-full h-full">
        {iframeContent}
      </div>
    );
  }

  // Expanded view rendered in a portal for proper z-index
  if (isExpanded && mounted && hasEverOpened) {
    return (
      <>
        {/* Placeholder to maintain layout */}
        <div className="h-[500px] bg-muted rounded-lg" />
        <ExpandedPreviewModal
          headerContent={headerControls}
          iframeContent={iframeContent}
          onClose={() => setIsExpanded(false)}
        />
      </>
    );
  }

  // Normal view - simple preview container
  return (
    <CollapsiblePreviewSection
      title="Page Preview"
      isCollapsed={isCollapsed}
      onToggle={handleToggleCollapse}
    >
      {headerControls}
      <PreviewFrame>{iframeContent}</PreviewFrame>
    </CollapsiblePreviewSection>
  );
};

export const PagePreview = forwardRef<PagePreviewHandle, PagePreviewProps>(PagePreviewInner);
