'use client';

import { ReactNode, RefObject, LegacyRef } from 'react';
import { createPortal } from 'react-dom';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Resolve the targetOrigin for postMessage to a preview iframe.
 * Falls back to "*" (with a console.warn) on missing or malformed URLs so a bad
 * site.config.yaml doesn't break the preview entirely — but logs the regression
 * so it's discoverable in dev tools instead of failing silently.
 */
export const getPreviewOrigin = (url: string | null | undefined): string => {
  if (!url) return '*';
  try {
    return new URL(url).origin;
  } catch (e) {
    console.warn('Invalid preview URL — falling back to wildcard postMessage origin:', url, e);
    return '*';
  }
};

/**
 * Transform media paths from CMS format (public/<dir>/...) to preview-accessible format (/<dir>/...)
 * Handles all media directories: uploads, files, bulletins, and any future additions.
 */
export const transformImagePaths = (data: Record<string, unknown>): Record<string, unknown> => {
  const result = { ...data };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === 'string' && value.startsWith('public/')) {
      result[key] = '/' + value.slice('public/'.length);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? transformImagePaths(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = transformImagePaths(value as Record<string, unknown>);
    }
  }
  return result;
};

/**
 * Toolbar with refresh, external link, and expand/minimize buttons
 */
interface PreviewToolbarProps {
  onReload: () => void;
  onOpenNewTab: () => void;
  onToggleExpand: () => void;
  isExpanded: boolean;
  isLoaded: boolean;
}

export function PreviewToolbar({
  onReload,
  onOpenNewTab,
  onToggleExpand,
  isExpanded,
  isLoaded,
}: PreviewToolbarProps) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onReload}
            disabled={!isLoaded}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Reload preview</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onOpenNewTab}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open in new tab</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isExpanded ? 'Minimize' : 'Expand'} preview
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/**
 * Simple preview frame container with consistent dimensions
 */
interface PreviewFrameProps {
  children: ReactNode;
}

export function PreviewFrame({ children }: PreviewFrameProps) {
  return (
    <div className="border rounded-lg overflow-hidden mt-2 h-[500px] bg-white">
      {children}
    </div>
  );
}

/**
 * Iframe with loading spinner overlay
 */
interface IFrameWrapperProps {
  url: string;
  title: string;
  onLoad: () => void;
  isLoaded: boolean;
  iframeRef: LegacyRef<HTMLIFrameElement>;
  refreshKey: number;
}

export function IFrameWrapper({
  url,
  title,
  onLoad,
  isLoaded,
  iframeRef,
  refreshKey,
}: IFrameWrapperProps) {
  return (
    <div className="relative w-full h-full">
      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading preview...</span>
          </div>
        </div>
      )}
      <iframe
        key={refreshKey}
        ref={iframeRef}
        src={url}
        onLoad={onLoad}
        className={`w-full h-full border-0 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        title={title}
      />
    </div>
  );
}

/**
 * Full-screen modal for expanded preview (renders via portal)
 */
interface ExpandedPreviewModalProps {
  headerContent: ReactNode;
  iframeContent: ReactNode;
  onClose: () => void;
}

export function ExpandedPreviewModal({
  headerContent,
  iframeContent,
  onClose,
}: ExpandedPreviewModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80"
      onClick={onClose}
    >
      <div
        className="fixed inset-4 bg-white rounded-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {headerContent}
        <div className="flex-1 overflow-hidden">
          {iframeContent}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Collapsible section header for previews
 */
interface CollapsiblePreviewSectionProps {
  title: string;
  isCollapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CollapsiblePreviewSection({
  title,
  isCollapsed,
  onToggle,
  children,
}: CollapsiblePreviewSectionProps) {
  return (
    <div className="relative">
      {/* Section header with collapse toggle */}
      <div
        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-t-lg px-1 py-1 -mx-1"
        onClick={onToggle}
      >
        <span className="text-sm font-medium">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </div>

      {!isCollapsed && (
        <div className="mt-2">
          {children}
        </div>
      )}
    </div>
  );
}
