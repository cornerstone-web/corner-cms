"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveFirstArticle } from "@/lib/actions/setup-steps";
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
  initialAuthor?: string;
  initialCategory?: string;
  initialDescription?: string;
  initialProseContent?: string;
}

export default function FirstArticleStep({
  site,
  onComplete,
  initialTitle,
  initialAuthor,
  initialCategory,
  initialDescription,
  initialProseContent,
}: StepProps) {
  const [title, setTitle] = useState(initialTitle ?? "");
  const [author, setAuthor] = useState(initialAuthor ?? "");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [proseContent, setProseContent] = useState(initialProseContent ?? "");
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
      setError("Please enter an article title.");
      return;
    }
    if (!author.trim()) {
      setError("Please enter the author's name.");
      return;
    }
    if (!proseContent.trim()) {
      setError("Please add content for the article.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveFirstArticle(site.id, site.slug, {
        title: title.trim(),
        author: author.trim(),
        category: category.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(proseContent.trim() ? { proseContent: proseContent.trim() } : {}),
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
        <h2 className="text-xl font-semibold">First Article</h2>
        <p className="text-muted-foreground text-sm">
          Publish your first article or blog post.
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
          <Label htmlFor="article-category">
            Category{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Input
            id="article-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Announcements"
          />
          <p className="text-xs text-muted-foreground">
            Categories let visitors filter articles by topic — for example,
            Announcements, Devotionals, or a custom series term.
          </p>
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
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            Keep this brief — it appears in article listings. Use the Content section below to share the full details.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>
            Content <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            The body of the article page.
          </p>
          <WizardProseEditor value={proseContent} onChange={setProseContent} />
        </div>
        <div className="space-y-1.5">
          <Label>
            Article Image{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground -mt-0.5">
            Shown as a thumbnail in article listings.
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
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
