"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveFeature } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

export default function SermonFeatureStep({ church, onComplete }: StepProps) {
  const [selection, setSelection] = useState<boolean | null>(null);
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
        await saveFeature(church.id, church.slug, "sermons", true);
      } else {
        const result = await completeStep(church.id, "sermons");
        if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
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
        <h2 className="text-xl font-semibold">Sermon Library</h2>
        <p className="text-muted-foreground text-sm">
          Do you want a sermon library on your site?
        </p>
        <p className="text-muted-foreground text-sm">
          A sermon library lets you upload and organize your messages for visitors to listen to or watch online.
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
          <p className="font-medium text-sm">Yes, add a sermon library</p>
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
