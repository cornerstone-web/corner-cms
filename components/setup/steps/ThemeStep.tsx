"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveTheme } from "@/lib/actions/setup-steps";
import { cn } from "@/lib/utils";

interface StepProps {
  site: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialTheme?: string;
  initialCustomColors?: Record<string, string>;
}

// ─── Theme presets ────────────────────────────────────────────────────────────

const THEMES = [
  {
    value: "default", label: "Classic", description: "Clean and professional",
    swatches: ["hsl(0 0% 0%)", "hsl(0 0% 20%)", "hsl(0 0% 40%)", "hsl(0 0% 98%)"],
  },
  {
    value: "forest", label: "Forest", description: "Earthy greens and warm tones",
    swatches: ["hsl(150 60% 25%)", "hsl(150 45% 35%)", "hsl(80 70% 45%)", "hsl(150 20% 99%)"],
  },
  {
    value: "ocean", label: "Ocean", description: "Cool blues and ocean hues",
    swatches: ["hsl(210 80% 30%)", "hsl(210 60% 40%)", "hsl(190 90% 45%)", "hsl(210 30% 99%)"],
  },
  {
    value: "warm", label: "Warm", description: "Welcoming warm tones",
    swatches: ["hsl(25 80% 25%)", "hsl(25 60% 35%)", "hsl(35 90% 50%)", "hsl(40 30% 98%)"],
  },
  { value: "custom", label: "Custom", description: "Choose your own colors", swatches: [] },
];

// ─── Custom color fields (mirrors ThemeSection in site settings) ──────────────

const CUSTOM_THEME_FIELDS = [
  { name: "primary",           label: "Primary",           default: "hsl(0 0% 0%)" },
  { name: "primaryForeground", label: "Primary Foreground", default: "hsl(0 0% 100%)" },
  { name: "secondary",         label: "Secondary",          default: "hsl(0 0% 20%)" },
  { name: "accent",            label: "Accent",             default: "hsl(0 0% 40%)" },
  { name: "background",        label: "Background",         default: "hsl(0 0% 100%)" },
  { name: "surface",           label: "Surface",            default: "hsl(0 0% 98%)" },
  { name: "text",              label: "Text",               default: "hsl(0 0% 10%)" },
  { name: "textMuted",         label: "Text Muted",         default: "hsl(0 0% 50%)" },
  { name: "border",            label: "Border",             default: "hsl(0 0% 90%)" },
] as const;

type CustomColorKey = (typeof CUSTOM_THEME_FIELDS)[number]["name"];

// ─── HSL <-> Hex helpers ──────────────────────────────────────────────────────

function parseHsl(hsl: string): { h: number; s: number; l: number } | null {
  const match = hsl.match(
    /hsl\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*\)/i,
  );
  if (!match) return null;
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslStringToHex(hsl: string): string {
  const parsed = parseHsl(hsl);
  if (!parsed) return "#000000";
  return hslToHex(parsed.h, parsed.s, parsed.l);
}

function hexToHslString(hex: string): string {
  const parsed = hexToHsl(hex);
  if (!parsed) return "hsl(0 0% 0%)";
  return `hsl(${parsed.h} ${parsed.s}% ${parsed.l}%)`;
}

function resolveHex(value: string, fallback: string): string {
  if (value.match(/^#[0-9a-f]{3,6}$/i)) return value;
  if (value.startsWith("hsl")) return hslStringToHex(value);
  return hslStringToHex(fallback);
}

// ─── Component ────────────────────────────────────────────────────────────────

type CustomColors = Partial<Record<CustomColorKey, string>>;

export default function ThemeStep({ site, onComplete, initialTheme, initialCustomColors }: StepProps) {
  const [selectedTheme, setSelectedTheme] = useState(initialTheme ?? "default");
  const [customColors, setCustomColors] = useState<CustomColors>(initialCustomColors ?? {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setColor(name: CustomColorKey, hslValue: string) {
    setCustomColors((prev) => ({ ...prev, [name]: hslValue }));
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const customTheme =
        selectedTheme === "custom"
          ? Object.fromEntries(
              CUSTOM_THEME_FIELDS.map(({ name, default: def }) => [
                name,
                customColors[name] ?? def,
              ]),
            )
          : undefined;

      await saveTheme(site.id, site.slug, selectedTheme, customTheme);
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

      {/* Theme picker */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
            {theme.swatches.length > 0 && (
              <div className="flex gap-1 mt-2">
                {theme.swatches.map((color, i) => (
                  <span
                    key={i}
                    className="h-4 w-4 rounded-full border border-black/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Custom color pickers */}
      {selectedTheme === "custom" && (
        <div className="space-y-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Custom Colors</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pick from the color swatch or enter an HSL value (e.g. hsl(210 50% 40%)).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {CUSTOM_THEME_FIELDS.map(({ name, label, default: def }) => {
              const value = customColors[name] ?? "";
              const hexValue = resolveHex(value || def, def);
              return (
                <div key={name} className="space-y-1.5">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={hexValue}
                      onChange={(e) => setColor(name, hexToHslString(e.target.value))}
                      className="h-10 w-10 shrink-0 cursor-pointer rounded border border-input p-0.5"
                    />
                    <Input
                      placeholder={def}
                      value={value}
                      onChange={(e) => setColor(name, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? "Saving..." : "Continue →"}
      </Button>
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
