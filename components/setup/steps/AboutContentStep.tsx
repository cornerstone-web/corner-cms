"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveAboutPage } from "@/lib/actions/setup-steps";
import WizardProseEditor from "@/components/setup/WizardProseEditor";

const DEFAULT_ABOUT_PROSE = `## Our Story

We are a local congregation dedicated to worshiping God and serving our community. Over the years, God has blessed our family with growth, and we are grateful for every person He has sent our way.

## Our Mission

We exist to help people find and follow Jesus.

## Our Values

*   **Authenticity**: We come as we are, not as we pretend to be
*   **Community**: We believe life is better together
*   **Generosity**: We give freely because we've been given much
*   **Growth**: We never stop learning and becoming more like Jesus`;

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialProseContent?: string;
}

export default function AboutContentStep({ church, onComplete, initialProseContent }: StepProps) {
  const [proseContent, setProseContent] = useState(initialProseContent ?? DEFAULT_ABOUT_PROSE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      await saveAboutPage(church.id, church.slug, proseContent.trim());
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">About Us Page</h2>
        <p className="text-muted-foreground text-sm">
          Tell your story. Edit the content that will appear on your About Us page.
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
