"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveFeature } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: (enabled: boolean) => void;
  initialEnabled?: boolean;
}

export default function BulletinsFeatureStep({ church, onComplete, initialEnabled }: StepProps) {
  const [selection, setSelection] = useState<boolean | null>(initialEnabled ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (selection === null) {
      setError("Please make a selection.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      if (selection) {
        await saveFeature(church.id, church.slug, "bulletins", true);
      } else {
        const result = await completeStep(church.id, "bulletins");
        if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
      }
      onComplete(!!selection);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Bulletins &amp; Announcements</h2>
        <p className="text-muted-foreground text-sm">
          Do you publish weekly bulletins or announcements?
        </p>
        <p className="text-muted-foreground text-sm">
          A bulletins section lets you upload PDF bulletins and weekly announcements for your site to download.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setSelection(true)}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            selection === true
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">Yes, add a bulletins section</p>
        </button>
        <button
          type="button"
          onClick={() => setSelection(false)}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            selection === false
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">No, skip this feature</p>
        </button>
      </div>
      <div className="flex items-center gap-4">
        <Button onClick={handleSubmit} disabled={isLoading || selection === null}>
          {isLoading ? "Saving..." : "Continue →"}
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
