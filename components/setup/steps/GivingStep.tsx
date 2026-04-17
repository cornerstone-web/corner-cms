"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGiving } from "@/lib/actions/setup-steps";
import { cn } from "@/lib/utils";

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialGivingUrl?: string;
}

export default function GivingStep({
  site,
  onComplete,
  initialGivingUrl,
}: StepProps) {
  const [hasGiving, setHasGiving] = useState<boolean | null>(
    initialGivingUrl === undefined ? null : initialGivingUrl ? true : false,
  );
  const [givingUrl, setGivingUrl] = useState(initialGivingUrl ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (hasGiving === null) {
      setError("Please make a selection.");
      return;
    }
    if (hasGiving === true && givingUrl.trim() === "") {
      setError("Please enter your giving platform URL.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveGiving(
        site.id,
        site.slug,
        hasGiving ? givingUrl.trim() : "",
      );
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
          Does your site accept online donations?
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
          <p className="font-medium text-sm">
            Yes, we have an online giving platform
          </p>
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
            This can be a link to Tithe.ly, Pushpay, PayPal, or any other giving
            platform.
          </p>
        </div>
      )}
      <Button onClick={handleSubmit} disabled={isLoading || hasGiving === null}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
