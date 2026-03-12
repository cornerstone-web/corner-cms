"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstSeries } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialTitle?: string;
  initialDescription?: string;
}

export default function FirstSeriesStep({ church, onComplete, initialTitle, initialDescription }: StepProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Please enter a series name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstSeries(church.id, church.slug, {
        title: title.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
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
        <h2 className="text-xl font-semibold">First Sermon Series</h2>
        <p className="text-muted-foreground text-sm">
          Create your first series to group sermons together. It is recommended
          to start with a series that will include your first sermon on the next
          step.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="series-title">
            Series name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="series-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Walking in Faith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="series-description">
            Description{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Textarea
            id="series-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this series about?"
            rows={3}
          />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
