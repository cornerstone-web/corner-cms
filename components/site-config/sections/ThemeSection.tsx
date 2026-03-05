"use client";

import { useEffect, useMemo } from "react";
import { Control, useWatch, useFormContext } from "react-hook-form";
import { HelpCircle } from "lucide-react";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { SiteConfigFormValues } from "../schema";

// ---------------------------------------------------------------------------
// HSL <-> Hex conversion helpers
// ---------------------------------------------------------------------------

function parseHsl(hsl: string): { h: number; s: number; l: number } | null {
  // Match hsl(H S% L%) or hsl(H, S%, L%)
  const match = hsl.match(
    /hsl\(\s*([\d.]+)\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*\)/i
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
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
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
  let h = 0;
  let s = 0;
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

// ---------------------------------------------------------------------------
// Google Fonts presets
// ---------------------------------------------------------------------------

const GOOGLE_FONTS = [
  { name: "Inter", family: "'Inter', system-ui, sans-serif", google: "Inter:wght@400;500;600;700" },
  { name: "Roboto", family: "'Roboto', system-ui, sans-serif", google: "Roboto:wght@400;500;700" },
  { name: "Open Sans", family: "'Open Sans', system-ui, sans-serif", google: "Open+Sans:wght@400;600;700" },
  { name: "Lato", family: "'Lato', system-ui, sans-serif", google: "Lato:wght@400;700" },
  { name: "Poppins", family: "'Poppins', system-ui, sans-serif", google: "Poppins:wght@400;500;600;700" },
  { name: "Montserrat", family: "'Montserrat', system-ui, sans-serif", google: "Montserrat:wght@400;500;600;700" },
  { name: "Playfair Display", family: "'Playfair Display', Georgia, serif", google: "Playfair+Display:wght@400;500;600;700" },
  { name: "Merriweather", family: "'Merriweather', Georgia, serif", google: "Merriweather:wght@400;700" },
  { name: "Raleway", family: "'Raleway', system-ui, sans-serif", google: "Raleway:wght@400;500;600;700" },
  { name: "Source Sans 3", family: "'Source Sans 3', system-ui, sans-serif", google: "Source+Sans+3:wght@400;600;700" },
];

function findFontByFamily(family: string) {
  return GOOGLE_FONTS.find((f) => f.family === family);
}

// ---------------------------------------------------------------------------
// Theme options
// ---------------------------------------------------------------------------

const THEME_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "warm", label: "Warm" },
  { value: "ocean", label: "Ocean" },
  { value: "forest", label: "Forest" },
  { value: "custom", label: "Custom" },
];

const CUSTOM_THEME_FIELDS = [
  { name: "primary" as const, label: "Primary", default: "hsl(0 0% 0%)" },
  { name: "primaryForeground" as const, label: "Primary Foreground", default: "hsl(0 0% 100%)" },
  { name: "secondary" as const, label: "Secondary", default: "hsl(0 0% 20%)" },
  { name: "accent" as const, label: "Accent", default: "hsl(0 0% 40%)" },
  { name: "background" as const, label: "Background", default: "hsl(0 0% 100%)" },
  { name: "surface" as const, label: "Surface", default: "hsl(0 0% 98%)" },
  { name: "text" as const, label: "Text", default: "hsl(0 0% 10%)" },
  { name: "textMuted" as const, label: "Text Muted", default: "hsl(0 0% 50%)" },
  { name: "border" as const, label: "Border", default: "hsl(0 0% 90%)" },
];

// ---------------------------------------------------------------------------
// ThemeSection
// ---------------------------------------------------------------------------

interface ThemeSectionProps {
  control: Control<SiteConfigFormValues>;
}

export function ThemeSection({ control }: ThemeSectionProps) {
  const theme = useWatch({ control, name: "theme" });

  return (
    <div className="space-y-6">
      <FormField
        control={control}
        name="theme"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Color Theme</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {THEME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {theme === "custom" && (
        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-sm font-medium">Custom Colors</h3>
          <p className="text-sm text-muted-foreground">
            Use HSL values (e.g., hsl(210 50% 40%)) or pick from the color swatch.
          </p>
          <div className="grid grid-cols-2 gap-4">
            {CUSTOM_THEME_FIELDS.map(({ name, label, default: defaultValue }) => (
              <ColorPickerField key={name} control={control} name={name} label={label} defaultValue={defaultValue} />
            ))}
          </div>
        </div>
      )}

      <FontsSection control={control} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Color picker + text input combo
// ---------------------------------------------------------------------------

function ColorPickerField({
  control,
  name,
  label,
  defaultValue,
}: {
  control: Control<SiteConfigFormValues>;
  name: (typeof CUSTOM_THEME_FIELDS)[number]["name"];
  label: string;
  defaultValue: string;
}) {
  return (
    <FormField
      control={control}
      name={`customTheme.${name}`}
      render={({ field }) => {
        const resolvedValue = field.value || defaultValue;
        const hexValue = resolvedValue.match(/^#[0-9a-f]{3,6}$/i) ? resolvedValue : hslStringToHex(resolvedValue);
        return (
          <FormItem>
            <FormLabel className="text-xs">{label}</FormLabel>
            <div className="flex gap-2">
              <input
                type="color"
                value={hexValue}
                onChange={(e) => field.onChange(hexToHslString(e.target.value))}
                className="w-10 h-10 rounded border border-input cursor-pointer shrink-0 p-0.5"
              />
              <FormControl>
                <Input
                  placeholder={defaultValue}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Fonts section with dropdown presets
// ---------------------------------------------------------------------------

function FontsSection({ control }: { control: Control<SiteConfigFormValues> }) {
  const { setValue } = useFormContext<SiteConfigFormValues>();
  const headingFamily = useWatch({ control, name: "fonts.heading" });
  const bodyFamily = useWatch({ control, name: "fonts.body" });

  const headingFont = findFontByFamily(headingFamily);
  const bodyFont = findFontByFamily(bodyFamily);
  const isHeadingCustom = !headingFont;
  const isBodyCustom = !bodyFont;

  // Auto-generate google fonts parameter when both fonts are presets
  const autoGoogleParam = useMemo(() => {
    const parts: string[] = [];
    if (headingFont) parts.push(headingFont.google);
    if (bodyFont && bodyFont.name !== headingFont?.name) parts.push(bodyFont.google);
    return parts.length > 0 ? parts.join("&family=") : null;
  }, [headingFont, bodyFont]);

  const isGoogleAutoGenerated = !isHeadingCustom && !isBodyCustom;

  // Sync auto-generated google param to form value
  useEffect(() => {
    if (isGoogleAutoGenerated && autoGoogleParam) {
      setValue("fonts.google", autoGoogleParam, { shouldDirty: true });
    }
  }, [isGoogleAutoGenerated, autoGoogleParam, setValue]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Fonts</h3>

      <FontField
        control={control}
        name="fonts.heading"
        label="Heading Font"
        autoGoogleParam={autoGoogleParam}
      />

      <FontField
        control={control}
        name="fonts.body"
        label="Body Font"
        autoGoogleParam={autoGoogleParam}
      />

      <FormField
        control={control}
        name="fonts.google"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>Google Fonts Parameter</FormLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-sm">
                  <p>
                    Loads fonts from Google&apos;s CDN. When using preset fonts, this is
                    auto-generated. For custom fonts, enter the family parameter
                    from{" "}
                    <a
                      href="https://fonts.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-medium"
                    >
                      fonts.google.com
                    </a>
                    {" "}(e.g., &quot;Oswald:wght@400;700&quot;).
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <FormControl>
              <Input
                placeholder="Inter:wght@400;500;600;700"
                {...field}
                value={isGoogleAutoGenerated ? (autoGoogleParam ?? "") : (field.value ?? "")}
                disabled={isGoogleAutoGenerated}
                onChange={(e) => {
                  if (!isGoogleAutoGenerated) field.onChange(e);
                }}
              />
            </FormControl>
            {isGoogleAutoGenerated && (
              <FormDescription>
                Auto-generated from preset font selections
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function FontField({
  control,
  name,
  label,
  autoGoogleParam,
}: {
  control: Control<SiteConfigFormValues>;
  name: "fonts.heading" | "fonts.body";
  label: string;
  autoGoogleParam: string | null;
}) {
  const currentValue = useWatch({ control, name });
  const matchedFont = findFontByFamily(currentValue);
  const isCustom = !matchedFont;

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={isCustom ? "__custom__" : matchedFont.name}
            onValueChange={(fontName) => {
              if (fontName === "__custom__") {
                field.onChange("");
              } else {
                const font = GOOGLE_FONTS.find((f) => f.name === fontName);
                if (font) field.onChange(font.family);
              }
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select a font..." />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {GOOGLE_FONTS.map((font) => (
                <SelectItem key={font.name} value={font.name}>
                  {font.name}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Custom</SelectItem>
            </SelectContent>
          </Select>
          {isCustom && (
            <FormControl>
              <Input
                placeholder="'CustomFont', system-ui, sans-serif"
                {...field}
                value={field.value ?? ""}
                className="mt-2"
              />
            </FormControl>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
