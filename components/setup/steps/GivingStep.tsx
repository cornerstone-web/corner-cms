"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGiving } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

export default function GivingStep({ church, onComplete }: StepProps) {
  const [hasGiving, setHasGiving] = useState<boolean | null>(null);
  const [givingUrl, setGivingUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      if (hasGiving && givingUrl.trim()) {
        await saveGiving(church.id, church.slug, givingUrl.trim());
      } else {
        const result = await completeStep(church.id, "giving");
        if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await completeStep(church.id, "giving");
      if (!result.ok) throw new Error(result.error ?? "Failed to complete step.");
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Online Giving</h2>
        <p className="text-muted-foreground text-sm">
          Does your church accept online donations?
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setHasGiving(true)}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            hasGiving === true
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">Yes, we have an online giving platform</p>
        </button>
        <button
          type="button"
          onClick={() => setHasGiving(false)}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            hasGiving === false
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">No, not yet</p>
        </button>
      </div>
      {hasGiving === true && (
        <div className="space-y-1.5">
          <Label htmlFor="giving-url">Giving Platform URL</Label>
          <Input
            id="giving-url"
            type="url"
            value={givingUrl}
            onChange={(e) => setGivingUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-muted-foreground">
            This can be a link to Tithe.ly, Pushpay, PayPal, or any other giving platform.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button onClick={handleSubmit} disabled={isLoading || hasGiving === null}>
          {isLoading ? "Saving..." : "Continue →"}
        </Button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={isLoading}
          className="text-sm text-muted-foreground underline hover:text-foreground disabled:opacity-50"
        >
          Skip this step →
        </button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
