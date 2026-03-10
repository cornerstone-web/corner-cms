"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveTheme } from "@/lib/actions/setup-steps";
import { cn } from "@/lib/utils";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
}

const THEMES = [
  { value: "default", label: "Classic", description: "Clean and professional" },
  { value: "forest", label: "Forest", description: "Earthy greens and warm tones" },
  { value: "ocean", label: "Ocean", description: "Cool blues and ocean hues" },
  { value: "warm", label: "Warm", description: "Welcoming warm tones" },
];

export default function ThemeStep({ church, onComplete }: StepProps) {
  const [selectedTheme, setSelectedTheme] = useState("default");
  const [customColor, setCustomColor] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      await saveTheme(
        church.id,
        church.slug,
        selectedTheme,
        customColor || undefined,
      );
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Theme &amp; Colors</h2>
        <p className="text-muted-foreground text-sm">Choose a visual style for your site.</p>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {THEMES.map((theme) => (
            <button
              key={theme.value}
              type="button"
              onClick={() => setSelectedTheme(theme.value)}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
                selectedTheme === theme.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-background",
              )}
            >
              <p className="font-medium text-sm">{theme.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{theme.description}</p>
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="custom-color">Custom primary color (optional)</Label>
          <div className="flex items-center gap-3">
            <input
              id="custom-color"
              type="color"
              value={customColor || "#000000"}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-9 w-16 cursor-pointer rounded border border-input bg-background p-0.5"
            />
            {customColor && (
              <button
                type="button"
                onClick={() => setCustomColor("")}
                className="text-xs text-muted-foreground underline hover:text-foreground"
              >
                Clear
              </button>
            )}
            {!customColor && (
              <span className="text-xs text-muted-foreground">None set — theme default will be used</span>
            )}
          </div>
        </div>
      </div>
      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
