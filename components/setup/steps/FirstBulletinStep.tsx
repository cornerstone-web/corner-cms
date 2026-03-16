"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFirstBulletin } from "@/lib/actions/setup-steps";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialDate?: string;
  initialPasswordProtected?: boolean;
  initialPassword?: string;
}

export default function FirstBulletinStep({ church, onComplete, initialDate, initialPasswordProtected, initialPassword }: StepProps) {
  const [date, setDate] = useState(initialDate ?? "");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [passwordProtected, setPasswordProtected] = useState(initialPasswordProtected ?? false);
  const [password, setPassword] = useState(initialPassword ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const base64 = await fileToBase64(file);
    setPdfBase64(base64);
    setPdfFileName(file.name);
  }

  const hasExisting = Boolean(initialDate);

  async function handleSubmit() {
    if (!date) {
      setError("Please select a date for this bulletin.");
      return;
    }
    if (!pdfBase64 && !hasExisting) {
      setError("Please upload a PDF for this bulletin.");
      return;
    }
    if (passwordProtected && !password.trim()) {
      setError("Please enter a password for the bulletins page.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstBulletin(church.id, church.slug, {
        date,
        pdfBase64: pdfBase64 ?? "",
        passwordProtected,
        ...(passwordProtected ? { password: password.trim() } : {}),
      });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">First Bulletin</h2>
        <p className="text-muted-foreground text-sm">
          Upload your first bulletin PDF to get your bulletin archive started.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="bulletin-date">
            Bulletin Date <span className="text-destructive">*</span>
          </Label>
          <Input
            id="bulletin-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Bulletin PDF{" "}
            {hasExisting
              ? <span className="text-muted-foreground text-xs">(upload a new one to replace)</span>
              : <span className="text-destructive">*</span>
            }
          </Label>
          {hasExisting && !pdfFileName && (
            <p className="text-xs text-muted-foreground">
              Currently uploaded: <span className="font-medium">{initialDate}.pdf</span>
            </p>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {pdfFileName && (
            <p className="text-xs text-muted-foreground">Selected: {pdfFileName}</p>
          )}
        </div>
        <div className="space-y-3">
          <Label>Password Protection</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setPasswordProtected(false)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${!passwordProtected ? "border-primary bg-primary/5 text-primary font-medium" : "border-input text-muted-foreground hover:border-foreground"}`}
            >
              No password
            </button>
            <button
              type="button"
              onClick={() => setPasswordProtected(true)}
              className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${passwordProtected ? "border-primary bg-primary/5 text-primary font-medium" : "border-input text-muted-foreground hover:border-foreground"}`}
            >
              Password protect
            </button>
          </div>
          {passwordProtected && (
            <div className="space-y-1.5">
              <Label htmlFor="bulletin-password">Password</Label>
              <Input
                id="bulletin-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter a password..."
              />
              <p className="text-xs text-muted-foreground">
                All members will need to enter this password to view the bulletins page.
              </p>
            </div>
          )}
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Uploading..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
