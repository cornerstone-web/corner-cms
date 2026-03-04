"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { useConfig } from "@/contexts/config-context";
import { MediaView, MediaCategory } from "@/components/media/media-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSchemaByName } from "@/lib/schema";

const R2_CATEGORIES: MediaCategory[] = ["video", "audio"];

export interface MediaDialogHandle {
  open: () => void;
  close: () => void;
}

const MediaDialog = forwardRef(({
  media,
  category,
  selected,
  onSubmit,
  maxSelected,
  initialPath,
  children,
  extensions,
  title
}: {
  media?: string,
  category?: MediaCategory,
  onSubmit: (images: string[]) => void,
  selected?: string[],
  maxSelected?: number,
  initialPath?: string,
  children?: React.ReactNode,
  extensions?: string[],
  title?: string
}, ref) => {
  const { config } = useConfig();
  if (!config) throw new Error(`Configuration not found.`);

  // Resolve which category to show. Explicit `category` wins; otherwise default
  // to "images" so all existing image-picker usages continue to work unchanged.
  const resolvedCategory: MediaCategory = category ?? "images";

  const isR2Category = R2_CATEGORIES.includes(resolvedCategory);

  // For GitHub-mode categories we still look up the media config so we know
  // whether the media folder is configured (used to decide if the Select button
  // should be shown). For R2 categories this is not needed.
  const configMedia = isR2Category
    ? null
    : media
      ? getSchemaByName(config.object, media, "media")
      : config.object.media.find((item: any) => item.name === resolvedCategory)
          ?? config.object.media[0];

  const selectedImagesRef = useRef(selected || []);
  const [selectedImages, setSelectedImages] = useState(selected || []);
  const [open, setOpen] = useState(false);

  const handleSelect = useCallback((newSelected: string[]) => {
    selectedImagesRef.current = newSelected;
    setSelectedImages(newSelected);
  }, []);

  const handleSubmit = useCallback(() => {
    onSubmit(selectedImagesRef.current);
  }, [onSubmit]);

  // MediaView calls onUpload with either a GitHub entry (has `.path`) or an R2
  // entry (has `.url`). We push whichever identifier is present so that the
  // caller receives the correct value for both storage backends.
  const handleUpload = useCallback((entry: any) => {
    const identifier: string = entry.url ?? entry.path;
    if (!identifier) return;
    const newSelected = [...selectedImagesRef.current, identifier];
    selectedImagesRef.current = newSelected;
    setSelectedImages(newSelected);
  }, []);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
  }));

  // Show the Select footer when:
  //   - R2 category: always (no configMedia.input gate needed)
  //   - GitHub category: only when the media config has an input path defined
  const showFooter = isR2Category ? true : Boolean(configMedia?.input);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children &&
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      }
      <DialogContent className="w-full sm:max-w-screen-xl sm:w-[calc(100vw-6rem)] h-[calc(100vh-6rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>{title ?? "Select file"}</DialogTitle>
          <DialogDescription></DialogDescription>
        </DialogHeader>

        <MediaView
          media={isR2Category ? undefined : (configMedia?.name ?? media)}
          category={resolvedCategory}
          extensions={extensions}
          initialSelected={selectedImages}
          onSelect={handleSelect}
          onUpload={handleUpload}
          maxSelected={maxSelected}
          initialPath={initialPath || ""}
        />
        {showFooter &&
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="submit"
                onClick={handleSubmit}
                disabled={selectedImages.length === 0}
              >
                Select
              </Button>
            </DialogClose>
          </DialogFooter>
        }
      </DialogContent>
    </Dialog>
  );
});

MediaDialog.displayName = "MediaDialog";

export { MediaDialog };
