"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveHero } from "@/lib/actions/setup-steps";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

type Mode = "photo" | "video";

export default function HeroStep({ church, onComplete }: StepProps) {
  const [mode, setMode] = useState<Mode>("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  function handleModeChange(newMode: Mode) {
    setMode(newMode);
    setError(null);
  }

  async function handleSubmit() {
    setError(null);

    if (mode === "photo") {
      if (!file) {
        setError("Please select a hero image.");
        return;
      }
      setIsLoading(true);
      try {
        const base64 = await fileToBase64(file);
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        await saveHero(church.id, church.slug, { imageBase64: base64, imageExt: ext });
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setIsLoading(false);
      }
    } else {
      if (!videoUrl.trim()) {
        setError("Please enter a YouTube video URL.");
        return;
      }
      setIsLoading(true);
      try {
        await saveHero(church.id, church.slug, { videoUrl: videoUrl.trim() });
        onComplete();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setIsLoading(false);
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Home Page Hero</h2>
        <p className="text-muted-foreground text-sm">
          Choose a hero image or YouTube video to display prominently on your home page.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => handleModeChange("photo")}
          className={cn(
            "flex-1 py-2 px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset",
            mode === "photo"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          Upload a photo
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("video")}
          className={cn(
            "flex-1 py-2 px-4 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset border-l",
            mode === "video"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
        >
          Use a YouTube video
        </button>
      </div>

      {/* Photo mode */}
      {mode === "photo" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="hero-upload">Hero image</Label>
            <input
              id="hero-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>
          {preview && (
            <div className="rounded-lg border p-4 bg-muted/30 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Hero preview"
                className="max-h-48 max-w-full object-contain rounded"
              />
            </div>
          )}
        </div>
      )}

      {/* Video mode */}
      {mode === "video" && (
        <div className="space-y-1.5">
          <Label htmlFor="hero-video-url">YouTube video URL</Label>
          <Input
            id="hero-video-url"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="text-xs text-muted-foreground">
            Paste the full URL to your YouTube video.
          </p>
        </div>
      )}

      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
