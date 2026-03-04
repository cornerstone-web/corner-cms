"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConfig } from "@/contexts/config-context";
import {
  extensionCategories,
  sortFiles,
  getFileSize,
  getParentPath,
  getFileName,
  normalizePath
} from "@/lib/utils/file";
import { EmptyCreate } from "@/components/empty-create";
import { FolderCreate} from "@/components/folder-create";
import { FileOptions } from "@/components/file/file-options";
import { PathBreadcrumb } from "@/components/path-breadcrumb";
import { MediaUpload} from "./media-upload";
import { FilePreviewModal } from "./file-preview-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Message } from "@/components/message";
import { Thumbnail } from "@/components/thumbnail";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CornerLeftUp,
  Ban,
  Check,
  EllipsisVertical,
  File,
  Film,
  Folder,
  FolderPlus,
  Music,
  Trash2,
  Upload
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MediaCategory = "images" | "video" | "audio" | "files" | "bulletins";

/** R2 file shape returned by the r2-list API */
interface R2File {
  name: string;
  url: string;
  size: number;
  uploadedAt: string | null;
}

// ---------------------------------------------------------------------------
// Extension map per category
// ---------------------------------------------------------------------------

const CATEGORY_EXTENSIONS: Record<MediaCategory, string[]> = {
  images: extensionCategories.image ?? [],
  video: extensionCategories.video ?? [],
  audio: extensionCategories.audio ?? [],
  files: extensionCategories.document ?? [],
  bulletins: extensionCategories.document ?? [],
};

const R2_CATEGORIES: MediaCategory[] = ["video", "audio"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const MediaView = ({
  media,
  category = "images",
  initialPath,
  initialSelected,
  maxSelected,
  onSelect,
  onUpload,
  extensions
}: {
  media?: string,
  category?: MediaCategory,
  initialPath?: string,
  initialSelected?: string[],
  maxSelected?: number,
  onSelect?: (newSelected: string[]) => void,
  onUpload?: (entry: any) => void,
  extensions?: string[]
}) => {
  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);

  const isR2Category = R2_CATEGORIES.includes(category);

  // -------------------------------------------------------------------------
  // GitHub-mode: resolve mediaConfig from configObject.media
  // -------------------------------------------------------------------------

  const mediaConfig = useMemo(() => {
    if (isR2Category) return null; // not needed for R2

    // Prefer explicit `media` prop, then match by category name, then first media config
    if (media) {
      return config.object.media.find((item: any) => item.name === media)
        ?? config.object.media[0];
    }
    return config.object.media.find((item: any) => item.name === category)
      ?? config.object.media[0];
  }, [media, category, isR2Category, config.object.media]);

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const filteredExtensions = useMemo(() => {
    if (isR2Category) {
      return CATEGORY_EXTENSIONS[category];
    }
    if (!mediaConfig?.extensions && !extensions) return CATEGORY_EXTENSIONS[category];
    const allowedExtensions = extensions
      ? mediaConfig?.extensions
        ? extensions.filter((ext: string) => mediaConfig.extensions.includes(ext))
        : extensions
      : mediaConfig.extensions;
    return allowedExtensions || [];
  }, [extensions, mediaConfig, isR2Category, category]);

  const filesGridRef = useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState<string | null | undefined>(null);
  const [selected, setSelected] = useState(initialSelected || []);

  useEffect(() => {
    setSelected(initialSelected || []);
  }, [initialSelected]);

  // -------------------------------------------------------------------------
  // GitHub-mode state
  // -------------------------------------------------------------------------

  const [path, setPath] = useState(() => {
    if (isR2Category || !mediaConfig) return "";
    if (!initialPath) return mediaConfig.input;
    const normalizedInitialPath = normalizePath(initialPath);
    if (normalizedInitialPath.startsWith(mediaConfig.input)) return normalizedInitialPath;
    console.warn(`"${initialPath}" is not within media root "${mediaConfig.input}". Defaulting to media root.`);
    return mediaConfig.input;
  });

  const [data, setData] = useState<Record<string, any>[] | undefined>(undefined);
  const [previewFile, setPreviewFile] = useState<Record<string, any> | null>(null);

  const filteredData = useMemo(() => {
    if (!data) return undefined;
    if (!filteredExtensions || filteredExtensions.length === 0) return data;
    return data.filter(item =>
      item.type === "dir" ||
      filteredExtensions.includes(item.extension?.toLowerCase())
    );
  }, [data, filteredExtensions]);

  // -------------------------------------------------------------------------
  // R2-mode state
  // -------------------------------------------------------------------------

  const [r2Files, setR2Files] = useState<R2File[]>([]);
  const [r2Loading, setR2Loading] = useState(false);
  const [r2Error, setR2Error] = useState<string | null>(null);
  const [r2PreviewFile, setR2PreviewFile] = useState<R2File | null>(null);

  const fetchR2Files = useCallback(async () => {
    if (!isR2Category) return;
    setR2Loading(true);
    setR2Error(null);
    try {
      const res = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/media/r2-list?category=${category}`
      );
      const json = await res.json() as { status: string; data?: R2File[]; message?: string };
      if (json.status !== "success") throw new Error(json.message ?? "Failed to list files");
      setR2Files(json.data ?? []);
    } catch (err: any) {
      console.error(err);
      setR2Error(err.message);
    } finally {
      setR2Loading(false);
    }
  }, [isR2Category, config.owner, config.repo, config.branch, category]);

  // -------------------------------------------------------------------------
  // GitHub-mode fetch
  // -------------------------------------------------------------------------

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isR2Category) {
      setIsLoading(false);
      return;
    }
    if (!mediaConfig) return;

    async function fetchMedia() {
      if (config && mediaConfig) {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(
            `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/media/${encodeURIComponent(mediaConfig.name)}/${encodeURIComponent(path)}`
          );
          if (!response.ok) throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
          const responseData: any = await response.json();
          if (responseData.status !== "success") throw new Error(responseData.message);
          setData(responseData.data);
        } catch (fetchError: any) {
          console.error(fetchError);
          setError(fetchError.message);
        } finally {
          setIsLoading(false);
        }
      }
    }
    fetchMedia();
  }, [config, path, mediaConfig, isR2Category]);

  // Fetch R2 files on mount (and whenever category changes)
  useEffect(() => {
    if (isR2Category) {
      fetchR2Files();
    }
  }, [isR2Category, fetchR2Files]);

  // -------------------------------------------------------------------------
  // Handlers — GitHub mode
  // -------------------------------------------------------------------------

  const handleUpload = useCallback((entry: any) => {
    setData((prevData) => {
      if (!prevData) return [entry];
      return sortFiles([...prevData, entry]);
    });
    if (onUpload) onUpload(entry);
  }, [onUpload]);

  const handleDelete = useCallback((deletePath: string) => {
    setData((prevData) => prevData?.filter((item) => item.path !== deletePath));
  }, []);

  const handleRename = useCallback((renamePath: string, newPath: string) => {
    setData((prevData) => {
      if (!prevData) return;
      if (getParentPath(normalizePath(renamePath)) === getParentPath(normalizePath(newPath))) {
        const newData = prevData?.map((item) => {
          return item.path === renamePath ? { ...item, path: newPath, name: getFileName(newPath) } : item;
        });
        return sortFiles(newData);
      }
      return prevData?.filter((item) => item.path !== renamePath);
    });
  }, []);

  const handleFolderCreate = useCallback((entry: any) => {
    const parentPath = getParentPath(entry.path);
    const parent = {
      type: "dir",
      name: getFileName(parentPath),
      path: parentPath,
      size: 0,
      url: null,
    };
    setData((prevData) => {
      if (!prevData) return [parent];
      return sortFiles([...prevData, parent]);
    });
  }, []);

  const handleNavigate = (newPath: string) => {
    setPath(newPath);
    if (!onSelect) {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      params.set("path", newPath || (mediaConfig?.input ?? ""));
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const handleNavigateParent = () => {
    if (!path || !mediaConfig || path === mediaConfig.input) return;
    handleNavigate(getParentPath(path));
  };

  const handleSelect = useCallback((selectPath: string) => {
    setSelected((prevSelected) => {
      let newSelected = prevSelected;
      if (maxSelected != null && prevSelected.length >= maxSelected) {
        newSelected = maxSelected > 1
          ? newSelected.slice(1 - maxSelected)
          : [];
      }
      newSelected = newSelected.includes(selectPath)
        ? newSelected.filter(item => item !== selectPath)
        : [...newSelected, selectPath];
      return newSelected;
    });
  }, [maxSelected]);

  useEffect(() => {
    if (onSelect) onSelect(selected);
  }, [selected, onSelect]);

  // -------------------------------------------------------------------------
  // Handlers — R2 mode
  // -------------------------------------------------------------------------

  const handleR2Upload = useCallback((entry: any) => {
    // Refresh the full list after an R2 upload so the new file appears
    fetchR2Files();
    if (onUpload) onUpload(entry);
  }, [fetchR2Files, onUpload]);

  const handleR2Delete = useCallback(async (fileUrl: string, fileName: string) => {
    if (!window.confirm(`Delete "${fileName}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/media/r2-delete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: fileUrl }),
        }
      );
      const json = await res.json() as { status: string; message?: string };
      if (json.status !== "success") throw new Error(json.message ?? "Delete failed");
      // Remove from local state immediately for snappy UX, then refresh
      setR2Files((prev) => prev.filter((f) => f.url !== fileUrl));
    } catch (err: any) {
      console.error(err);
      setR2Error(err.message);
    }
  }, [config.owner, config.repo, config.branch]);

  // -------------------------------------------------------------------------
  // Shared loading skeleton
  // -------------------------------------------------------------------------

  const loadingSkeleton = useMemo(() => (
    <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
      <li>
        <div className="flex items-center justify-center aspect-video text-muted">
          <Folder className="stroke-[0.5] h-[5.5rem] w-[5.5rem] animate-pulse"/>
        </div>
        <div className="flex items-center justify-center p-2">
          <div className="overflow-hidden h-9">
            <Skeleton className="w-24 h-5 rounded mb-2"/>
          </div>
        </div>
      </li>
      {[...Array(3)].map((_, index) => (
        <li key={index}>
          <Skeleton className="rounded-t-md rounded-b-none aspect-video" />
          <div className="flex items-center gap-x-2 p-2">
            <div className="overflow-hidden h-9">
              <Skeleton className="w-24 h-5 rounded mb-2"/>
              <Skeleton className="w-16 h-2 rounded"/>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 ml-auto" disabled>
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  ), []);

  // =========================================================================
  // R2 MODE RENDER
  // =========================================================================

  if (isR2Category) {
    return (
      <div className="flex-1 flex flex-col space-y-4">
        <header className="flex items-center gap-x-2">
          <div className="sm:flex-1" />
          <MediaUpload uploadTarget="r2" category={category as "video" | "audio"} onUpload={handleR2Upload} extensions={filteredExtensions} multiple>
            <MediaUpload.Trigger>
              <Button type="button" size="sm" className="gap-2">
                <Upload className="h-3.5 w-3.5"/>
                Upload
              </Button>
            </MediaUpload.Trigger>
          </MediaUpload>
        </header>

        <MediaUpload uploadTarget="r2" category={category as "video" | "audio"} onUpload={handleR2Upload} extensions={filteredExtensions} multiple>
          <MediaUpload.DropZone className="flex-1 overflow-auto scrollbar">
            <div className="h-full relative flex flex-col" ref={filesGridRef}>
              {r2Loading
                ? loadingSkeleton
                : r2Error
                  ? <p className="text-destructive flex items-center justify-center text-sm p-6">
                      {r2Error}
                    </p>
                  : r2Files.length > 0
                    ? <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 p-1">
                        {r2Files.map((file, index) => (
                          <li key={file.url}>
                            <label htmlFor={`r2-item-${index}`}>
                              {onSelect && (
                                <input
                                  type="checkbox"
                                  id={`r2-item-${index}`}
                                  className="peer sr-only"
                                  checked={selected.includes(file.url)}
                                  onChange={() => handleSelect(file.url)}
                                />
                              )}
                              <div className={onSelect ? "rounded-md border border-border overflow-hidden hover:bg-muted peer-checked:ring-offset-background peer-checked:ring-offset-2 peer-checked:ring-2 peer-checked:ring-ring relative" : "rounded-md border border-border overflow-hidden"}>
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-center aspect-video bg-muted/30 hover:bg-muted/60 transition-colors cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  onClick={(e) => { e.preventDefault(); setR2PreviewFile(file); }}
                                  aria-label={`Preview ${file.name}`}
                                >
                                  {category === "video"
                                    ? <Film className="stroke-[0.5] h-24 w-24 text-muted-foreground"/>
                                    : <Music className="stroke-[0.5] h-24 w-24 text-muted-foreground"/>
                                  }
                                </button>
                                <div className="flex gap-x-2 items-center p-2">
                                  <div className="overflow-hidden mr-auto h-9">
                                    <div className="text-sm font-medium truncate" title={file.name}>{file.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{getFileSize(file.size)}</div>
                                  </div>
                                  {!onSelect && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="shrink-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleR2Delete(file.url, file.name)}
                                      aria-label={`Delete ${file.name}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                                {onSelect && selected.includes(file.url) && (
                                  <div className="text-primary-foreground bg-primary p-0.5 rounded-full absolute top-2 left-2">
                                    <Check className="stroke-[3] w-3 h-3"/>
                                  </div>
                                )}
                              </div>
                            </label>
                          </li>
                        ))}
                      </ul>
                    : <p className="text-muted-foreground flex items-center justify-center text-sm p-6">
                        <Ban className="h-4 w-4 mr-2"/>
                        No {category} files uploaded yet.
                      </p>
              }
            </div>
          </MediaUpload.DropZone>
        </MediaUpload>

        {/* R2 preview dialog */}
        <Dialog open={!!r2PreviewFile} onOpenChange={(open) => !open && setR2PreviewFile(null)}>
          <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="text-base truncate pr-8">{r2PreviewFile?.name}</DialogTitle>
              <DialogDescription className="text-xs">
                {r2PreviewFile ? getFileSize(r2PreviewFile.size) : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/30 flex items-center justify-center p-4">
              {r2PreviewFile && category === "video" && (
                <video
                  src={r2PreviewFile.url}
                  controls
                  className="max-h-[65vh] w-full"
                  preload="metadata"
                />
              )}
              {r2PreviewFile && category === "audio" && (
                <audio
                  src={r2PreviewFile.url}
                  controls
                  className="w-full"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // =========================================================================
  // GITHUB MODE RENDER (images, files, bulletins)
  // =========================================================================

  if (!mediaConfig) {
    return (
      <Message
        title="No media defined"
        description="You have no media defined in your settings."
        className="absolute inset-0"
        cta="Go to settings"
        href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/settings`}
      />
    );
  }

  if (!mediaConfig.input) {
    return (
      <Message
        title="No media defined"
        description="You have no media defined in your settings."
        className="absolute inset-0"
        cta="Go to settings"
        href={`/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/settings`}
      />
    );
  }

  if (error) {
    // TODO: should we use a custom error class with code?
    if (path === mediaConfig.input && error === "Not found") {
      return (
        <Message
            title="Media folder missing"
            description={`The media folder "${mediaConfig.input}" has not been created yet.`}
            className="absolute inset-0"
          >
          <EmptyCreate type="media" name={mediaConfig.name}>Create folder</EmptyCreate>
        </Message>
      );
    } else {
      return (
        <Message
          title="Something's wrong..."
          description={error}
          className="absolute inset-0"
        >
          <Button size="sm" onClick={() => handleNavigate(mediaConfig.input)}>Go to media root</Button>
        </Message>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col space-y-4">
      <header className="flex items-center gap-x-2">
        <div className="sm:flex-1">
          <PathBreadcrumb path={path} rootPath={mediaConfig.input} handleNavigate={handleNavigate} className="hidden sm:block"/>
          <Button onClick={handleNavigateParent} size="icon-sm" variant="outline" className="shrink-0 sm:hidden" disabled={!path || path === mediaConfig.input}>
            <CornerLeftUp className="w-4 h-4"/>
          </Button>
        </div>
        <FolderCreate path={path} name={mediaConfig.name} type="media" onCreate={handleFolderCreate}>
          <Button type="button" variant="outline" className="ml-auto" size="icon-sm">
            <FolderPlus className="h-3.5 w-3.5"/>
          </Button>
        </FolderCreate>
        <MediaUpload media={mediaConfig.name} path={path} onUpload={handleUpload} extensions={filteredExtensions}>
          <MediaUpload.Trigger>
            <Button type="button" size="sm" className="gap-2">
              <Upload className="h-3.5 w-3.5"/>
              Upload
            </Button>
          </MediaUpload.Trigger>
        </MediaUpload>
      </header>
      <MediaUpload media={mediaConfig.name} path={path} onUpload={handleUpload} extensions={filteredExtensions}>
        <MediaUpload.DropZone className="flex-1 overflow-auto scrollbar">
          <div className="h-full relative flex flex-col" ref={filesGridRef}>
            {isLoading
              ? loadingSkeleton
              : filteredData && filteredData.length > 0
                ? <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8 p-1">
                    {filteredData.map((item, index) =>
                      <li key={item.path}>
                        {item.type === "dir"
                          ? <button
                              className="hover:bg-muted focus:ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2 outline-none rounded-md block w-full"
                              onClick={() => handleNavigate(item.path)}
                            >
                              <div className="flex items-center justify-center aspect-video">
                                <Folder className="stroke-[0.5] h-[5.5rem] w-[5.5rem]"/>
                              </div>
                              <div className="flex items-center justify-center p-2">
                                <div className="overflow-hidden h-9">
                                  <div className="text-sm font-medium truncate">{item.name}</div>
                                </div>
                              </div>
                            </button>
                          : <label htmlFor={`item-${index}`}>
                              {onSelect &&
                                <input
                                  type="checkbox"
                                  id={`item-${index}`}
                                  className="peer sr-only"
                                  checked={selected.includes(item.path)}
                                  onChange={() => handleSelect(item.path)}
                                />
                              }
                              <div className={onSelect ? "hover:bg-muted peer-focus:ring-offset-background peer-focus:ring-2 peer-focus:ring-ring peer-focus:ring-offset-2 rounded-md peer-checked:ring-offset-background peer-checked:ring-offset-2 peer-checked:ring-2 peer-checked:ring-ring relative" : undefined}>
                                <button
                                  type="button"
                                  className="w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-zoom-in"
                                  onClick={(e) => { e.preventDefault(); setPreviewFile(item); }}
                                  aria-label={`Preview ${item.name}`}
                                >
                                  {extensionCategories.image.includes(item.extension)
                                    ? <Thumbnail name={mediaConfig.name} path={item.path} className="rounded-t-md aspect-video"/>
                                    : extensionCategories.video.includes(item.extension)
                                      ? <div className="flex items-center justify-center rounded-t-md aspect-video">
                                          <Film className="stroke-[0.5] h-24 w-24"/>
                                        </div>
                                      : extensionCategories.audio.includes(item.extension)
                                        ? <div className="flex items-center justify-center rounded-t-md aspect-video">
                                            <Music className="stroke-[0.5] h-24 w-24"/>
                                          </div>
                                        : <div className="flex items-center justify-center rounded-t-md aspect-video">
                                            <File className="stroke-[0.5] h-24 w-24"/>
                                          </div>
                                  }
                                </button>
                                <div className="flex gap-x-2 items-center p-2">
                                  <div className="overflow-hidden mr-auto h-9">
                                    <div className="text-sm font-medium truncate">{item.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{getFileSize(item.size)}</div>
                                  </div>
                                  <FileOptions path={item.path} sha={item.sha} type="media" name={mediaConfig.name} onDelete={handleDelete} onRename={handleRename} portalProps={{container: filesGridRef.current}}>
                                    <Button variant="ghost" size="icon" className="shrink-0">
                                      <EllipsisVertical className="h-4 w-4" />
                                    </Button>
                                  </FileOptions>
                                </div>
                                {onSelect && selected.includes(item.path) &&
                                  <div className="text-primary-foreground bg-primary p-0.5 rounded-full absolute top-2 left-2">
                                    <Check className="stroke-[3] w-3 h-3"/>
                                  </div>
                                }
                              </div>
                            </label>
                        }

                      </li>
                    )}
                  </ul>
                : <p className="text-muted-foreground flex items-center justify-center text-sm p-6">
                    <Ban className="h-4 w-4 mr-2"/>
                    This folder is empty.
                  </p>
            }
          </div>
        </MediaUpload.DropZone>
      </MediaUpload>
      <FilePreviewModal
        file={previewFile}
        files={(data ?? []).filter((item) => item.type === "file")}
        mediaName={mediaConfig.name}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
};

export { MediaView };
