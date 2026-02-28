"use client";

import { forwardRef, useCallback, useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { MediaUpload } from "@/components/media/media-upload";
import { MediaDialog } from "@/components/media/media-dialog";
import { MediaPreview } from "@/components/media/media-preview";
import { Trash2, Upload, FolderOpen, ArrowUpRight } from "lucide-react";
import { useConfig } from "@/contexts/config-context";
import { getFileName, normalizePath, extensionCategories } from "@/lib/utils/file";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { v4 as uuidv4 } from "uuid";
import { getSchemaByName } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Field } from "@/types/field";

const generateId = () => uuidv4().slice(0, 8);

export interface MediaFieldConfig {
  type: "video" | "audio";
  hint: string;
}

export interface ComponentProps {
  value: any;
  field: Field;
  onChange: (value: any) => void;
  [key: string]: any;
}

function getAllowedExtensions(
  type: "video" | "audio",
  field: Field,
  mediaConfig?: any,
): string[] | undefined {
  const baseExtensions = [...(extensionCategories[type] || [])];

  if (!mediaConfig) {
    if (!field.options?.extensions && !field.options?.categories) return baseExtensions;
    if (field.options?.extensions && Array.isArray(field.options.extensions)) {
      return [...field.options.extensions];
    } else if (Array.isArray(field.options?.categories)) {
      return field.options.categories.flatMap(
        (category: string) => extensionCategories[category] || [],
      );
    }
    return baseExtensions;
  }

  if (!field.options?.extensions && !field.options?.categories)
    return mediaConfig?.extensions || baseExtensions;

  let extensions = baseExtensions;
  if (field.options?.extensions && Array.isArray(field.options?.extensions)) {
    extensions = [...field.options.extensions];
  } else if (Array.isArray(field.options?.categories)) {
    extensions = field.options.categories.flatMap(
      (category: string) => extensionCategories[category] || [],
    );
  }

  if (extensions.length > 0 && mediaConfig?.extensions && Array.isArray(mediaConfig.extensions)) {
    extensions = extensions.filter((ext: string) => mediaConfig.extensions.includes(ext));
  }

  return extensions;
}

const MediaTeaser = ({
  file,
  config,
  mediaConfig,
  mediaFieldConfig,
  onRemove,
}: {
  file: string;
  config: any;
  mediaConfig: any;
  mediaFieldConfig: MediaFieldConfig;
  onRemove: () => void;
}) => {
  const isAbsoluteUrl = file.startsWith("http");

  return (
    <div className="space-y-2">
      <MediaPreview
        name={mediaConfig.name}
        path={file}
        type={mediaFieldConfig.type}
        className={
          mediaFieldConfig.type === "video"
            ? "w-full max-h-48 rounded border border-border bg-muted"
            : "w-full"
        }
      />
      <div className="grid grid-cols-[1fr_auto] items-center gap-2 pl-3 pr-1 bg-muted rounded-md h-10">
        <span className="truncate text-sm font-medium">{getFileName(file)}</span>
        <div className="flex items-center">
          {!isAbsoluteUrl && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a
                    href={`https://github.com/${config.owner}/${config.repo}/blob/${config.branch}/${file}`}
                    target="_blank"
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-xs" }),
                      "text-muted-foreground hover:text-foreground transition-colors",
                    )}
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </TooltipTrigger>
                <TooltipContent>See on GitHub</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={onRemove}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

const MediaFileEditComponent = forwardRef(
  (
    props: ComponentProps & { mediaFieldConfig: MediaFieldConfig },
    ref: React.Ref<HTMLInputElement>,
  ) => {
    const { value, field, onChange, mediaFieldConfig } = props;
    const { config } = useConfig();

    const [file, setFile] = useState<{ id: string; path: string } | null>(() =>
      value ? { id: generateId(), path: value } : null,
    );

    const mediaConfig = useMemo(() => {
      return config?.object?.media?.length && field.options?.media !== false
        ? field.options?.media && typeof field.options.media === "string"
          ? getSchemaByName(config.object, field.options.media, "media")
          : config.object.media[0]
        : undefined;
    }, [field.options?.media, config?.object]);

    const rootPath = useMemo(() => {
      if (!field.options?.path) return mediaConfig?.input;
      const normalizedPath = normalizePath(field.options.path as string);
      const normalizedMediaPath = normalizePath(mediaConfig?.input ?? "");
      if (!normalizedPath.startsWith(normalizedMediaPath)) {
        console.warn(
          `"${field.options.path}" is not within media root "${mediaConfig?.input}". Defaulting to media root.`,
        );
        return mediaConfig?.input;
      }
      return normalizedPath;
    }, [field.options?.path, mediaConfig?.input]);

    const allowedExtensions = useMemo(() => {
      return getAllowedExtensions(mediaFieldConfig.type, field, mediaConfig ?? undefined);
    }, [mediaFieldConfig.type, field, mediaConfig]);

    useEffect(() => {
      onChange(file?.path ?? undefined);
    }, [file, onChange]);

    const handleUpload = useCallback(
      (fileData: any) => {
        if (!config) return;
        setFile({ id: generateId(), path: fileData.path });
      },
      [config],
    );

    const handleRemove = useCallback(() => {
      setFile(null);
    }, []);

    const handleSelected = useCallback((newPaths: string[]) => {
      if (newPaths.length === 0) {
        setFile(null);
      } else {
        setFile({ id: generateId(), path: newPaths[0] });
      }
    }, []);

    if (!mediaConfig) {
      return (
        <p className="text-muted-foreground bg-muted rounded-md px-3 py-2">
          No media configuration found.{" "}
          <a
            href={`/${config?.owner}/${config?.repo}/${encodeURIComponent(config?.branch || "")}/settings`}
            className="underline hover:text-foreground"
          >
            Check your settings
          </a>
          .
        </p>
      );
    }

    return (
      <MediaUpload
        path={rootPath}
        media={mediaConfig.name}
        extensions={allowedExtensions}
        onUpload={handleUpload}
        multiple={false}
        uploadTarget="r2"
      >
        <MediaUpload.DropZone>
          <div className="space-y-2">
            {file && (
              <MediaTeaser
                file={file.path}
                config={config}
                mediaConfig={mediaConfig}
                mediaFieldConfig={mediaFieldConfig}
                onRemove={handleRemove}
              />
            )}
            {!file && (
              <div className="flex gap-2">
                <MediaUpload.Trigger>
                  <Button type="button" size="sm" variant="outline" className="gap-2">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </Button>
                </MediaUpload.Trigger>
                <TooltipProvider>
                  <Tooltip>
                    <MediaDialog
                      media={mediaConfig.name}
                      initialPath={rootPath}
                      maxSelected={1}
                      extensions={allowedExtensions}
                      onSubmit={handleSelected}
                      title={
                        mediaFieldConfig.type === "video" ? "Select video" : "Select audio"
                      }
                    >
                      <TooltipTrigger asChild>
                        <Button type="button" size="icon-sm" variant="outline">
                          <FolderOpen className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                    </MediaDialog>
                    <TooltipContent>Select from media</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">{mediaFieldConfig.hint}</p>
          </div>
        </MediaUpload.DropZone>
      </MediaUpload>
    );
  },
);

MediaFileEditComponent.displayName = "MediaFileEditComponent";

export { MediaFileEditComponent };
