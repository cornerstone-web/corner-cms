"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveLogo } from "@/lib/actions/setup-steps";
import { compressImage } from "@/lib/utils/image-compression";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialLogoUrl?: string;
}

export default function LogoStep({
  church,
  onComplete,
  initialLogoUrl,
}: StepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialLogoUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function handleSubmit() {
    if (!file && !preview) {
      setError("Please select a logo image.");
      return;
    }
    if (!file && preview) {
      // Already has a logo — advance without re-uploading
      onComplete();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const compressed = await compressImage(file!, "logo");
      const base64 = await fileToBase64(compressed);
      await saveLogo(church.id, church.slug, base64);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Church Logo</h2>
        <p className="text-muted-foreground text-sm">
          Upload your church logo.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="logo-upload">Logo image</Label>
          <input
            ref={inputRef}
            id="logo-upload"
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
              alt="Logo preview"
              className="max-h-40 max-w-full object-contain"
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
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix to get raw base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
