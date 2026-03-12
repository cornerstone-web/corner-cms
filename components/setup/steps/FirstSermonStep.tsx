"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstSermon } from "@/lib/actions/setup-steps";
import WizardProseEditor from "@/components/setup/WizardProseEditor";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialTitle?: string;
  initialDate?: string;
  initialSpeaker?: string;
  initialSeries?: string;
  initialDescription?: string;
  initialProseContent?: string;
  initialVideoUrl?: string;
}

export default function FirstSermonStep({
  church,
  onComplete,
  initialTitle,
  initialDate,
  initialSpeaker,
  initialSeries,
  initialDescription,
  initialProseContent,
  initialVideoUrl,
}: StepProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [speaker, setSpeaker] = useState(initialSpeaker ?? "");
  const [series, setSeries] = useState(initialSeries ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [proseContent, setProseContent] = useState(initialProseContent ?? "");
  const [videoUrl, setVideoUrl] = useState(initialVideoUrl ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Please enter a sermon title.");
      return;
    }
    if (!date) {
      setError("Please select a date.");
      return;
    }
    if (!speaker.trim()) {
      setError("Please enter the speaker's name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstSermon(church.id, church.slug, {
        title: title.trim(),
        date,
        speaker: speaker.trim(),
        ...(series.trim() ? { series: series.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(proseContent.trim() ? { proseContent: proseContent.trim() } : {}),
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
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
          Add a sermon to get your library started. You can add more from the
          CMS later.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="sermon-title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sermon-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. The Good Shepherd"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sermon-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sermon-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sermon-speaker">
              Speaker <span className="text-destructive">*</span>
            </Label>
            <Input
              id="sermon-speaker"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="John Smith"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sermon-series">
            Series{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="sermon-series"
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            placeholder="e.g. Walking in Faith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sermon-video-url">
            Video URL{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="sermon-video-url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="e.g. https://www.youtube.com/watch?v=..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sermon-description">
            Summary{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Textarea
            id="sermon-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short excerpt shown in sermon listings..."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Content{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            The body of the sermon page — notes, an outline, or a full transcript. Shown below the video on your site.
          </p>
          <WizardProseEditor value={proseContent} onChange={setProseContent} />
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
