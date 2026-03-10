"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveIdentity } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

export default function IdentityStep({ church, onComplete }: StepProps) {
  const [name, setName] = useState(church.displayName);
  const [tagline, setTagline] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError("Church name is required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveIdentity(church.id, church.slug, {
        name: name.trim(),
        ...(tagline.trim() ? { tagline: tagline.trim() } : {}),
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
        <h2 className="text-xl font-semibold">Church Identity</h2>
        <p className="text-muted-foreground text-sm">Tell us your church&apos;s name and tagline.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="church-name">Church name</Label>
          <Input
            id="church-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grace Community Church"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tagline">Tagline / short description</Label>
          <Input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="A place to belong"
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
