"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveVisitPage } from "@/lib/actions/setup-steps";
import WizardProseEditor from "@/components/setup/WizardProseEditor";

function buildDefaultVisitContent(times?: { day?: string; time?: string; name?: string; label?: string }[]) {
  const timesText = times?.length
    ? times.map((t) => `\n- **${t.label ?? t.name ?? t.day ?? ""}**: ${t.time ?? ""}`).join("")
    : "\n- Sunday 10:00 AM - Worship";
  return `## What to Expect

We're so glad you're considering a visit! Here's what you can expect when you join us:

### Service Times${timesText}

### What to Wear
Come as you are! You'll find people in everything from jeans to dress clothes. We want you to be comfortable.

### Where to Go
When you arrive, look for our Welcome Center in the main lobby. Our greeters will be happy to show you around and answer any questions.

### For Kids
We have age-appropriate classes for children of all ages during our morning Bible class hour. During worship, children are welcome to stay with their families.`;
}

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialProseContent?: string;
  initialServiceTimes?: { day?: string; time?: string; name?: string; label?: string }[];
}

export default function VisitContentStep({ site, onComplete, initialProseContent, initialServiceTimes }: StepProps) {
  const [proseContent, setProseContent] = useState(
    initialProseContent ?? buildDefaultVisitContent(initialServiceTimes)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      await saveVisitPage(site.id, site.slug, proseContent.trim());
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Plan Your Visit Page</h2>
        <p className="text-muted-foreground text-sm">
          Help first-time visitors know what to expect. Edit the content for your Plan Your Visit page.
        </p>
      </div>
      <div className="space-y-1.5">
        <WizardProseEditor value={proseContent} onChange={setProseContent} />
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
