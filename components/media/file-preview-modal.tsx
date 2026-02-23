"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Download, File, Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { extensionCategories, getFileSize } from "@/lib/utils/file";
import { getRawUrl } from "@/lib/githubImage";
import { useRepo } from "@/contexts/repo-context";
import { useConfig } from "@/contexts/config-context";

interface FilePreviewModalProps {
  file: Record<string, any> | null;
  files: Record<string, any>[];
  mediaName: string;
  onClose: () => void;
}

export function FilePreviewModal({ file, files, mediaName, onClose }: FilePreviewModalProps) {
  const [current, setCurrent] = useState<Record<string, any> | null>(file);
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { owner, repo, isPrivate } = useRepo();
  const { config } = useConfig();
  const branch = config?.branch!;

  // Sync internal current when the external file prop changes (new click)
  useEffect(() => {
    if (file) setCurrent(file);
  }, [file]);

  // Fetch the displayable URL whenever current file changes
  useEffect(() => {
    if (!current) { setDisplayUrl(null); setPdfBlobUrl(null); return; }

    let cancelled = false;
    setLoading(true);
    setDisplayUrl(null);
    setPdfBlobUrl(null);

    getRawUrl(owner, repo, branch, mediaName, current.path, isPrivate)
      .then(async (rawUrl) => {
        if (cancelled || !rawUrl) return;
        setDisplayUrl(rawUrl);

        // PDFs served from GitHub have Content-Disposition: attachment which
        // forces a download. Fetch as a blob so the iframe renders inline.
        if (current.extension === "pdf") {
          const res = await fetch(rawUrl);
          const arrayBuffer = await res.arrayBuffer();
          if (!cancelled) {
            // Force application/pdf MIME type — GitHub often serves PDFs as
            // application/octet-stream which causes browsers to download instead of preview.
            const pdfBlob = new Blob([arrayBuffer], { type: "application/pdf" });
            setPdfBlobUrl(URL.createObjectURL(pdfBlob));
          }
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      setPdfBlobUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.path, owner, repo, branch, mediaName, isPrivate]);

  const idx = current ? files.findIndex((f) => f.path === current.path) : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < files.length - 1;

  const isImage = current ? extensionCategories.image.includes(current.extension) : false;

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-base truncate pr-8">{current?.name}</DialogTitle>
          <DialogDescription className="text-xs">
            {current ? getFileSize(current.size) : ""}
          </DialogDescription>
        </DialogHeader>

        <div
          className="bg-muted/30 flex items-center justify-center overflow-hidden"
          style={{ minHeight: "300px" }}
        >
          {loading ? (
            <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : current && isImage && displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={current.name}
              className="max-h-[65vh] max-w-full object-contain"
            />
          ) : current && current.extension === "pdf" && pdfBlobUrl ? (
            <iframe
              src={pdfBlobUrl}
              title={current.name}
              className="w-full border-0"
              style={{ height: "65vh" }}
            />
          ) : current ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <File className="h-24 w-24 stroke-[0.5]" />
              <p className="text-sm">{current.name}</p>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => idx > 0 && setCurrent(files[idx - 1])}
              disabled={!hasPrev}
              aria-label="Previous file"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => idx >= 0 && setCurrent(files[idx + 1])}
              disabled={!hasNext}
              aria-label="Next file"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {files.length > 0 && idx >= 0 && (
              <span className="text-xs text-muted-foreground ml-2">
                {idx + 1} / {files.length}
              </span>
            )}
          </div>
          {displayUrl && (
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={current?.name}
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Download
              </Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
