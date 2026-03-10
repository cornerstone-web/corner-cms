"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstSermon } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

export default function FirstSermonStep({ church, onComplete }: StepProps) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [series, setSeries] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) { setError("Please enter a sermon title."); return; }
    if (!date) { setError("Please select a date."); return; }
    if (!speaker.trim()) { setError("Please enter the speaker's name."); return; }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstSermon(church.id, church.slug, {
        title: title.trim(),
        date,
        speaker: speaker.trim(),
        ...(series.trim() ? { series: series.trim() } : {}),
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
        <h2 className="text-xl font-semibold">First Sermon</h2>
        <p className="text-muted-foreground text-sm">
          Add a sermon to get your library started. You can add more from the CMS later.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sermon-title">Title <span className="text-destructive">*</span></Label>
          <Input
            id="sermon-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Good Shepherd"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sermon-date">Date <span className="text-destructive">*</span></Label>
            <Input
              id="sermon-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sermon-speaker">Speaker <span className="text-destructive">*</span></Label>
            <Input
              id="sermon-speaker"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="e.g. Pastor John"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sermon-series">Series <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Input
            id="sermon-series"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            placeholder="e.g. Walking in Faith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sermon-description">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
          <Textarea
            id="sermon-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief summary of this sermon..."
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
