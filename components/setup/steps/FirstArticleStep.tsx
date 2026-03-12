"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstArticle } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialTitle?: string;
  initialAuthor?: string;
  initialDescription?: string;
}

export default function FirstArticleStep({ church, onComplete, initialTitle, initialAuthor, initialDescription }: StepProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [author, setAuthor] = useState(initialAuthor ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Please enter an article title.");
      return;
    }
    if (!author.trim()) {
      setError("Please enter the author's name.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstArticle(church.id, church.slug, {
        title: title.trim(),
        author: author.trim(),
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
        <h2 className="text-xl font-semibold">First Article</h2>
        <p className="text-muted-foreground text-sm">
          Publish your first article or blog post. You can write the full
          content in the CMS editor afterward.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="article-title">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="article-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Welcome to Our New Website"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="article-author">
            Author <span className="text-destructive">*</span>
          </Label>
          <Input
            id="article-author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="e.g. John Smith"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="article-description">
            Excerpt{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Textarea
            id="article-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A short summary shown in article listings..."
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
