"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveIdentity } from "@/lib/actions/setup-steps";

interface StepProps {
  site: { id: string; displayName: string; slug: string; siteType?: "church" | "organization" };
  onComplete: () => void;
  initialName?: string;
  initialDescription?: string;
}

export default function IdentityStep({
  site,
  onComplete,
  initialName,
  initialDescription,
}: StepProps) {
  const isOrg = site.siteType === "organization";
  const nameLabel = isOrg ? "Organization name" : "Congregation name";
  const [name, setName] = useState(initialName ?? site.displayName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) {
      setError(`${nameLabel} is required.`);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await saveIdentity(site.id, site.slug, {
        name: name.trim(),
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
        <h2 className="text-xl font-semibold">Identity</h2>
        <p className="text-muted-foreground text-sm">
          Tell us your congregation&apos;s name and provide a short description.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="site-name">{nameLabel}</Label>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Grace Community Church"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">Short description</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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
