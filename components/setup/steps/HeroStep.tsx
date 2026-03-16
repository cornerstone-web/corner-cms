"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveHero } from "@/lib/actions/setup-steps";
import { compressImage } from "@/lib/utils/image-compression";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialHeroUrl?: string;
}

export default function HeroStep({ church, onComplete, initialHeroUrl }: StepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialHeroUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : (initialHeroUrl ?? null));
  }

  async function handleSubmit() {
    setError(null);
    if (!file && !initialHeroUrl) {
      setError("Please select a hero image.");
      return;
    }
    setIsLoading(true);
    try {
      if (file) {
        const compressed = await compressImage(file, "hero");
        const base64 = await fileToBase64(compressed);
        await saveHero(church.id, church.slug, { imageBase64: base64 });
      } else {
        // Re-completing with existing image — just mark step complete
        await saveHero(church.id, church.slug, {});
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
        <h2 className="text-xl font-semibold">Home Page Hero</h2>
        <p className="text-muted-foreground text-sm">
          Choose a hero image to display prominently on your home page. This
          will be the first thing visitors see, so make it engaging and
          representative of your church. We recommend using a high-quality image
          that is at least 1200px wide for the best results.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="hero-upload">
            Hero image{initialHeroUrl && <span className="text-muted-foreground text-xs ml-1">(upload a new one to replace)</span>}
          </Label>
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
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
