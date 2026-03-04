"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useConfig } from "@/contexts/config-context";
import { Button } from "@/components/ui/button";

type BrandingFile = "logo" | "favicon";

interface AssetState {
  sha: string | null;
  previewUrl: string | null;
  loading: boolean;
}

const CONSTRAINTS = {
  logo: {
    label: "Logo",
    accept: "image/png",
    hint: "PNG · max 500 KB · max 2000×800 px",
    maxBytes: 500 * 1024,
    maxWidth: 2000,
    maxHeight: 800,
  },
  favicon: {
    label: "Favicon",
    accept: "image/svg+xml",
    hint: "SVG · max 50 KB",
    maxBytes: 50 * 1024,
    maxWidth: null,
    maxHeight: null,
  },
} as const;

async function validateLogo(file: File): Promise<string | null> {
  if (file.type !== "image/png") return "Logo must be a PNG file";
  if (file.size > CONSTRAINTS.logo.maxBytes)
    return `Logo must be smaller than ${CONSTRAINTS.logo.maxBytes / 1024} KB`;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width > CONSTRAINTS.logo.maxWidth || img.height > CONSTRAINTS.logo.maxHeight) {
        resolve(
          `Logo must be at most ${CONSTRAINTS.logo.maxWidth}×${CONSTRAINTS.logo.maxHeight} px (uploaded: ${img.width}×${img.height} px)`
        );
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("Invalid image file");
    };
    img.src = url;
  });
}

function validateFavicon(file: File): string | null {
  const isSvg =
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (!isSvg) return "Favicon must be an SVG file";
  if (file.size > CONSTRAINTS.favicon.maxBytes)
    return `Favicon must be smaller than ${CONSTRAINTS.favicon.maxBytes / 1024} KB`;
  return null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface AssetUploadProps {
  type: BrandingFile;
  state: AssetState;
  onUpload: (file: File) => void;
}

function AssetUpload({ type, state, onUpload }: AssetUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const constraint = CONSTRAINTS[type];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-uploaded if needed
    e.target.value = "";
    onUpload(file);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{constraint.label}</p>
      <div className="flex items-center gap-4">
        {/* Preview */}
        <div
          className={`flex items-center justify-center rounded-md border bg-muted/30 overflow-hidden shrink-0 ${
            type === "logo" ? "h-16 w-48" : "h-10 w-10"
          }`}
        >
          {state.previewUrl ? (
            <img
              src={state.previewUrl}
              alt={constraint.label}
              className={type === "logo" ? "h-full w-auto object-contain px-2" : "h-full w-full object-contain p-1"}
            />
          ) : (
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        {/* Upload button */}
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={state.loading}
            onClick={() => inputRef.current?.click()}
          >
            {state.loading ? (
              <Loader className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {state.loading ? "Uploading…" : `Upload ${constraint.label}`}
          </Button>
          <p className="text-xs text-muted-foreground">{constraint.hint}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={constraint.accept}
        className="hidden"
        onChange={handleChange}
      />
    </div>
  );
}

export function BrandingSection() {
  const { config } = useConfig();

  const [logo, setLogo] = useState<AssetState>({
    sha: null,
    previewUrl: null,
    loading: false,
  });
  const [favicon, setFavicon] = useState<AssetState>({
    sha: null,
    previewUrl: null,
    loading: false,
  });

  const apiBase = config
    ? `/api/${config.owner}/${config.repo}/${encodeURIComponent(config.branch)}/site-config/branding`
    : null;

  // Fetch current files on mount
  useEffect(() => {
    if (!apiBase) return;

    const fetchAsset = async (type: BrandingFile) => {
      try {
        const res = await fetch(`${apiBase}?file=${type}`);
        const result = await res.json();
        if (result.status === "error") return;
        if (!result.data) return; // file doesn't exist yet

        const setter = type === "logo" ? setLogo : setFavicon;
        setter((prev) => ({
          ...prev,
          sha: result.data.sha,
          previewUrl: result.data.downloadUrl,
        }));
      } catch {
        // Non-fatal — preview just won't show
      }
    };

    fetchAsset("logo");
    fetchAsset("favicon");
  }, [apiBase]);

  const handleUpload = async (type: BrandingFile, file: File) => {
    if (!apiBase) return;

    // Client-side validation
    const error =
      type === "logo" ? await validateLogo(file) : validateFavicon(file);
    if (error) {
      toast.error(error);
      return;
    }

    const setter = type === "logo" ? setLogo : setFavicon;
    const currentState = type === "logo" ? logo : favicon;

    setter((prev) => ({ ...prev, loading: true }));
    try {
      const dataUrl = await readFileAsBase64(file);

      const res = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file: type,
          content: dataUrl,
          sha: currentState.sha ?? undefined,
        }),
      });

      const result = await res.json();
      if (result.status === "error") throw new Error(result.message);

      // Update preview with a fresh object URL and new SHA
      const previewUrl = URL.createObjectURL(file);
      setter({ sha: result.data.sha, previewUrl, loading: false });
      toast.success(
        `${type === "logo" ? "Logo" : "Favicon"} updated successfully.`
      );
    } catch (err: any) {
      setter((prev) => ({ ...prev, loading: false }));
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <AssetUpload
        type="logo"
        state={logo}
        onUpload={(file) => handleUpload("logo", file)}
      />
      <AssetUpload
        type="favicon"
        state={favicon}
        onUpload={(file) => handleUpload("favicon", file)}
      />
    </div>
  );
}
