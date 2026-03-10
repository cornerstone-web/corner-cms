"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStreaming } from "@/lib/actions/setup-steps";
import { completeStep } from "@/lib/actions/setup";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

export default function StreamingStep({ church, onComplete }: StepProps) {
  const [streamsLive, setStreamsLive] = useState<boolean | null>(null);
  const [youtubeApiKey, setYoutubeApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      if (streamsLive && youtubeApiKey.trim()) {
        await saveStreaming(church.id, church.slug, youtubeApiKey.trim());
      } else {
        const result = await completeStep(church.id, "streaming");
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
      const result = await completeStep(church.id, "streaming");
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
        <h2 className="text-xl font-semibold">Live Streaming</h2>
        <p className="text-muted-foreground text-sm">
          Do you stream your services live on YouTube?
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setStreamsLive(true)}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            streamsLive === true
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">Yes, we stream on YouTube</p>
        </button>
        <button
          type="button"
          onClick={() => setStreamsLive(false)}
          className={cn(
            "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
            streamsLive === false
              ? "border-primary bg-primary/5 ring-1 ring-primary"
              : "border-border bg-background",
          )}
        >
          <p className="font-medium text-sm">No</p>
        </button>
      </div>
      {streamsLive === true && (
        <div className="space-y-1.5">
          <Label htmlFor="youtube-api-key">YouTube API Key</Label>
          <Input
            id="youtube-api-key"
            type="text"
            value={youtubeApiKey}
            onChange={(e) => setYoutubeApiKey(e.target.value)}
            placeholder="AIza..."
          />
          <p className="text-xs text-muted-foreground">
            Need a YouTube API Key?{" "}
            <a
              href="https://developers.google.com/youtube/v3/getting-started"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Here&apos;s how to create one →
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            The API key enables your site to automatically detect and display your live stream.
          </p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Button onClick={handleSubmit} disabled={isLoading || streamsLive === null}>
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
