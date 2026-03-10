"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { savePhotos } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

interface PhotoEntry {
  base64: string;
  ext: string;
  name: string;
  previewUrl: string;
}

export default function PhotosStep({ church, onComplete }: StepProps) {
  const [wantsPhotos, setWantsPhotos] = useState<boolean | null>(null);
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    Promise.all(
      files.map(
        (file) =>
          new Promise<PhotoEntry>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.split(",")[1];
              const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
              resolve({ base64, ext, name: file.name, previewUrl: result });
            };
            reader.readAsDataURL(file);
          }),
      ),
    ).then(setPhotos);
  }

  async function handleSubmit() {
    if (wantsPhotos === null) {
      setError("Please make a selection.");
      return;
    }

    if (wantsPhotos && photos.length === 0) {
      setError("Please select at least one photo.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (wantsPhotos) {
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
          showcase your congregation and events.
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
          <div className="space-y-1.5">
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
                {photos.length} photo{photos.length !== 1 ? "s" : ""} selected
              </p>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="rounded overflow-hidden border bg-muted/30">
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
