"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveStreaming } from "@/lib/actions/setup-steps";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialYoutubeApiKey?: string;
}

export default function StreamingStep({ church, onComplete, initialYoutubeApiKey }: StepProps) {
  const [streamsLive, setStreamsLive] = useState<boolean | null>(
    initialYoutubeApiKey === undefined ? null : initialYoutubeApiKey ? true : false
  );
  const [youtubeApiKey, setYoutubeApiKey] = useState(initialYoutubeApiKey ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (streamsLive === null) {
      setError("Please make a selection.");
      return;
    }
    if (streamsLive === true && youtubeApiKey.trim() === "") {
      setError("Please enter your YouTube API key.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveStreaming(church.id, church.slug, streamsLive ? youtubeApiKey.trim() : "");
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
      <Button onClick={handleSubmit} disabled={isLoading || streamsLive === null}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
