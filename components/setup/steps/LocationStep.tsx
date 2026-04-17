"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveLocation } from "@/lib/actions/setup-steps";

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  onSkip?: () => void;
  initialStreet?: string;
  initialCity?: string;
  initialState?: string;
  initialZip?: string;
}

export default function LocationStep({
  site,
  onComplete,
  onSkip,
  initialStreet,
  initialCity,
  initialState,
  initialZip,
}: StepProps) {
  const [isSkipping, setIsSkipping] = useState(false);

  async function handleSkip() {
    if (!onSkip) return;
    setIsSkipping(true);
    try { onSkip(); } catch { setIsSkipping(false); }
  }
  const [street, setStreet] = useState(initialStreet ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [state, setState] = useState(initialState ?? "");
  const [zip, setZip] = useState(initialZip ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      await saveLocation(site.id, site.slug, {
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
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
        <h2 className="text-xl font-semibold">Location</h2>
        <p className="text-muted-foreground text-sm">
          Where is {site.displayName} located?
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="street">Street address</Label>
          <Input
            id="street"
            value={street}
            onChange={(e) => setStreet(e.target.value)}
            placeholder="123 Main Street"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Springfield"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="IL"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zip">ZIP code</Label>
            <Input
              id="zip"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="62701"
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Saving..." : "Continue →"}
        </Button>
        {onSkip && (
          <Button variant="ghost" onClick={handleSkip} disabled={isSkipping} className="text-muted-foreground">
            We don&apos;t have a physical location
          </Button>
        )}
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
