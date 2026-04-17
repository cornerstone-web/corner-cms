"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstSermon } from "@/lib/actions/setup-steps";
import WizardProseEditor from "@/components/setup/WizardProseEditor";
import { compressImage } from "@/lib/utils/image-compression";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface StepProps {
  site: { id: string; displayName: string; slug: string };
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
  site,
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
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageExt, setImageExt] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const compressed = await compressImage(file, "content");
    const preview = URL.createObjectURL(compressed);
    const base64 = await fileToBase64(compressed);
    const ext = compressed.type.split("/")[1] ?? "jpg";
    setImagePreview(preview);
    setImageBase64(base64);
    setImageExt(ext);
  }

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
    if (!proseContent.trim()) {
      setError("Please add content for the sermon page.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstSermon(site.id, site.slug, {
        title: title.trim(),
        date,
        speaker: speaker.trim(),
        ...(series.trim() ? { series: series.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(proseContent.trim() ? { proseContent: proseContent.trim() } : {}),
        ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
        ...(imageBase64 ? { imageBase64, imageExt: imageExt ?? "jpg" } : {}),
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
          <Label>
            Sermon Image{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            Shown as a thumbnail in sermon listings.
          </p>
          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
          />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagePreview} alt="Preview" className="mt-2 w-full max-h-40 object-cover rounded-md" />
          )}
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
          <p className="text-xs text-muted-foreground">
            Keep this brief — it appears in sermon listings. Use the Content section below to share the full details.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>
            Content <span className="text-destructive">*</span>
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
