"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveFavicon } from "@/lib/actions/setup-steps";
import { compressImage } from "@/lib/utils/image-compression";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialFaviconUrl?: string;
}

export default function FaviconStep({ church, onComplete, initialFaviconUrl }: StepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialFaviconUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) setPreview(URL.createObjectURL(selected));
  }

  async function handleSubmit() {
    if (!file && !preview) {
      setError("Please select a favicon file.");
      return;
    }
    if (!file && preview) {
      onComplete();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const compressed = await compressImage(file!, "logo");
      const ext = "png";
      const base64 = await fileToBase64(compressed);
      await saveFavicon(church.id, church.slug, base64, ext);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Favicon</h2>
        <p className="text-muted-foreground text-sm">
          Upload a favicon for your site. Accepts .ico, .png, or .svg.{" "}
          Need one? Generate it free at{" "}
          <a
            href="https://favicon.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-foreground hover:text-primary"
          >
            favicon.io
          </a>
          .
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="favicon-upload">Favicon file</Label>
        <input
          ref={inputRef}
          id="favicon-upload"
          type="file"
          accept=".ico,.png,.svg"
          onChange={handleFileChange}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
        />
        {preview && (
          <div className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Favicon preview" className="h-10 w-10 object-contain rounded border border-input" />
            {file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}
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
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
