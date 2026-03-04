"use client";

import { useState, useEffect } from "react";
import { getRawUrl } from "@/lib/githubImage";
import { useRepo } from "@/contexts/repo-context";
import { useConfig } from "@/contexts/config-context";

interface MediaPreviewProps {
  name: string;       // media config name (for getRawUrl)
  path: string;       // repo-relative path OR full https:// URL (R2)
  type: "video" | "audio";
  className?: string;
}

export function MediaPreview({ name, path, type, className }: MediaPreviewProps) {
  const { owner, repo, isPrivate } = useRepo();
  const { config } = useConfig();
  const branch = config?.branch!;

  const [src, setSrc] = useState<string | null>(
    // R2 absolute URLs can be used immediately — no async resolution needed
    path.startsWith("http") ? path : null
  );
  const [error, setError] = useState(false);

  useEffect(() => {
    if (path.startsWith("http")) {
      setSrc(path);
      return;
    }
    setError(false);
    getRawUrl(owner, repo, branch, name, path, isPrivate)
      .then((url) => setSrc(url))
      .catch(() => setError(true));
  }, [path, owner, repo, branch, name, isPrivate]);

  if (error) {
    return <div className="text-sm text-destructive">Failed to load preview</div>;
  }
  if (!src) {
    return <div className="text-sm text-muted-foreground">Loading preview…</div>;
  }

  if (type === "video") {
    return (
      <video
        src={src}
        controls
        className={className}
        preload="metadata"
      />
    );
  }
  return <audio src={src} controls className={className} />;
}
