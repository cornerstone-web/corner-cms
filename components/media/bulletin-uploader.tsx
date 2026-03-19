"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { checkBulletinUpload, performBulletinUpload } from "@/lib/actions/bulletins";
import type { BulletinCheckResult } from "@/lib/actions/bulletins";

const MAX_BULLETINS = 52;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type UploaderState =
  | "idle"
  | "checking"
  | "uploading"
  | "needs_confirmation"
  | "success"
  | "error";

interface BulletinUploaderProps {
  repoName: string;
  onSuccess?: () => void;
}

export function BulletinUploader({ repoName, onSuccess }: BulletinUploaderProps) {
  const [date, setDate] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [state, setState] = useState<UploaderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<BulletinCheckResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = state === "checking" || state === "uploading";

  function reset() {
    setDate("");
    setPdfFile(null);
    setState("idle");
    setError(null);
    setCheckResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!date) {
      setError("Please select a date for this bulletin.");
      return;
    }
    if (!pdfFile) {
      setError("Please select a PDF file.");
      return;
    }
    setError(null);
    setState("checking");

    try {
      const result = await checkBulletinUpload(repoName, date);
      setCheckResult(result);

      if (result.conflict) {
        setError("A bulletin for this date already exists.");
        setState("idle");
        return;
      }

      if (result.count >= MAX_BULLETINS) {
        setState("needs_confirmation");
        return;
      }

      await upload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("error");
    }
  }

  async function upload(deleteOldestName?: string) {
    if (!pdfFile) return;
    setState("uploading");
    try {
      const pdfBase64 = await fileToBase64(pdfFile);
      await performBulletinUpload(repoName, date, pdfBase64, deleteOldestName);
      setState("success");
      onSuccess?.();
      setTimeout(reset, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setState("error");
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bulletin-date">
            Bulletin Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bulletin-date"
            type="date"
            value={date}
            onChange={(e) => { setDate(e.target.value); setError(null); }}
            disabled={isBusy}
            className="w-auto"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bulletin-pdf">
            Bulletin PDF <span className="text-destructive">*</span>
          </Label>
          <input
            ref={fileInputRef}
            id="bulletin-pdf"
            type="file"
            accept="application/pdf"
            disabled={isBusy}
            onChange={(e) => { setPdfFile(e.target.files?.[0] ?? null); setError(null); }}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <Button onClick={handleSubmit} disabled={isBusy} className="w-full">
          {state === "checking"
            ? "Checking…"
            : state === "uploading"
              ? "Uploading…"
              : "Upload Bulletin"}
        </Button>

        {state === "success" && (
          <p className="text-sm text-green-700 dark:text-green-400">
            Bulletin uploaded successfully.
          </p>
        )}
        {(state === "error" || error) && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      <AlertDialog
        open={state === "needs_confirmation"}
        onOpenChange={(open) => { if (!open) setState("idle"); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Storage limit reached</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Only 1 year of bulletins is stored at a time. Uploading this bulletin will
                  permanently delete the oldest one:
                </p>
                <p className="font-medium text-foreground">{checkResult?.oldest?.name}</p>
                <p>Would you like to download it before it&apos;s deleted?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {checkResult?.oldest?.downloadUrl && (
              <Button variant="outline" asChild>
                <a
                  href={checkResult.oldest.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Download {checkResult.oldest.name}
                </a>
              </Button>
            )}
            <AlertDialogAction
              onClick={() => upload(checkResult?.oldest?.name)}
            >
              Delete oldest &amp; upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
