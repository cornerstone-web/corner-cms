"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstEvent } from "@/lib/actions/setup-steps";
import WizardProseEditor from "@/components/setup/WizardProseEditor";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialTitle?: string;
  initialDate?: string;
  initialTime?: string;
  initialLocation?: string;
  initialDescription?: string;
  initialProseContent?: string;
}

export default function FirstEventStep({ church, onComplete, initialTitle, initialDate, initialTime, initialLocation, initialDescription, initialProseContent }: StepProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [date, setDate] = useState(initialDate ?? "");
  const [time, setTime] = useState(initialTime ?? "");
  const [location, setLocation] = useState(initialLocation ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [proseContent, setProseContent] = useState(initialProseContent ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Please enter an event name.");
      return;
    }
    if (!date) {
      setError("Please select a date.");
      return;
    }
    if (!time.trim()) {
      setError("Please enter the event time.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstEvent(church.id, church.slug, {
        title: title.trim(),
        date,
        time: time.trim(),
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(proseContent.trim() ? { proseContent: proseContent.trim() } : {}),
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
        <h2 className="text-xl font-semibold">First Event</h2>
        <p className="text-muted-foreground text-sm">
          Add an upcoming event to your congregation&apos;s calendar.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="event-title">
            Event name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Community Cookout"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="event-time">
              Time <span className="text-destructive">*</span>
            </Label>
            <Input
              id="event-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="e.g. 10:00 AM"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-location">
            Location{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="event-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Fellowship Hall"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="event-description">
            Excerpt{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Textarea
            id="event-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description shown in event listings..."
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label>
            Content{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            The body of the event page — details, schedule, how to sign up.
          </p>
          <WizardProseEditor
            value={proseContent}
            onChange={setProseContent}
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
