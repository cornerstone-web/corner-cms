"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { markWelcomeComplete } from "@/lib/actions/setup-steps";

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  onNavigateToIdentity?: () => void;
}

export default function WelcomeStep({
  site,
  onComplete,
  onNavigateToIdentity,
}: StepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setIsLoading(true);
    setError(null);
    try {
      await markWelcomeComplete(site.id);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  if (onNavigateToIdentity) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Welcome to your site setup</h2>
          <p className="text-muted-foreground">
            We&apos;ll walk you through setting up your new website step by
            step. It should take about 15–20 minutes.
          </p>
        </div>
        <Button onClick={onNavigateToIdentity}>Continue →</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">Welcome to your site setup</h2>
        <p className="text-muted-foreground">
          We&apos;ll walk you through setting up {site.displayName}&apos;s website step by
          step. It should take about 15–20 minutes.
        </p>
      </div>
      <Button onClick={handleStart} disabled={isLoading}>
        {isLoading ? "Saving..." : "Let's Get Started →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
