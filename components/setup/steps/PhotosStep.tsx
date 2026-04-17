"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { savePhotos } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { cn } from "@/lib/utils";
import { compressImage } from "@/lib/utils/image-compression";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialPhotos?: { name: string; url: string }[];
}

interface PhotoEntry {
  base64: string;
  ext: string;
  name: string;
  previewUrl: string;
}

export default function PhotosStep({ church, onComplete, initialPhotos }: StepProps) {
  const hasExisting = (initialPhotos?.length ?? 0) > 0;
  const [wantsPhotos, setWantsPhotos] = useState<boolean | null>(hasExisting ? true : null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    try {
      const entries = await Promise.all(
        files.map(async (file) => {
          const compressed = await compressImage(file, "content");
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(compressed);
          });
          const ext = compressed.type.split("/")[1] ?? "jpg";
          const previewUrl = URL.createObjectURL(compressed);
          return { base64, ext, name: file.name, previewUrl };
        }),
      );
      setPhotos(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read one or more files.");
    }
  }

  async function handleSubmit() {
    if (wantsPhotos === null) {
      setError("Please make a selection.");
      return;
    }

    if (wantsPhotos && photos.length === 0 && !hasExisting) {
      setError("Please select at least one photo.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (wantsPhotos && photos.length > 0) {
        await savePhotos(
          church.id,
          church.slug,
          photos.map(({ base64, ext, name }) => ({ base64, ext, name })),
        );
      } else {
        const result = await completeStep(church.id, "photos");
        if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Featured Photos</h2>
        <p className="text-muted-foreground text-sm">
          Do you want to add featured photos to your home page?
        </p>
        <p className="text-muted-foreground text-sm">
          Featured photos appear as an animated scrolling strip on your home page — a great way to
          showcase your site and events.
        </p>
      </div>

      {/* Yes / No cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => {
            setWantsPhotos(true);
            setError(null);
          }}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            wantsPhotos === true
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">Yes, add featured photos</p>
        </button>
        <button
          type="button"
          onClick={() => {
            setWantsPhotos(false);
            setPhotos([]);
            setError(null);
          }}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            wantsPhotos === false
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">Skip for now</p>
        </button>
      </div>

      {/* Multi-file upload when "Yes" selected */}
      {wantsPhotos === true && (
        <div className="space-y-4">
          {/* Previously uploaded photos */}
          {hasExisting && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {initialPhotos!.length} photo{initialPhotos!.length !== 1 ? "s" : ""} already uploaded
              </p>
              <div className="grid grid-cols-4 gap-2">
                {initialPhotos!.map((photo) => (
                  <div key={photo.name} className="rounded overflow-hidden border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-20 object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-sm font-medium">
              {hasExisting ? "Upload additional photos (optional)" : "Upload photos"}
            </p>
            <input
              id="photos-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">
              We recommend at least 3 photos for the best effect.
            </p>
          </div>

          {photos.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                {photos.length} new photo{photos.length !== 1 ? "s" : ""} selected
              </p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((photo, i) => (
                  <div key={`${photo.name}-${i}`} className="rounded overflow-hidden border bg-muted/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={photo.name}
                      className="w-full h-20 object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={isLoading || wantsPhotos === null}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
