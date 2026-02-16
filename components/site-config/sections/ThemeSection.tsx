"use client";

import { Control, UseFormWatch } from "react-hook-form";
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
import type { SiteConfigFormValues } from "../schema";

interface ThemeSectionProps {
  control: Control<SiteConfigFormValues>;
  watch: UseFormWatch<SiteConfigFormValues>;
}

const THEME_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "warm", label: "Warm" },
  { value: "ocean", label: "Ocean" },
  { value: "forest", label: "Forest" },
  { value: "custom", label: "Custom" },
];

const CUSTOM_THEME_FIELDS = [
  { name: "primary" as const, label: "Primary" },
  { name: "primaryForeground" as const, label: "Primary Foreground" },
  { name: "secondary" as const, label: "Secondary" },
  { name: "accent" as const, label: "Accent" },
  { name: "background" as const, label: "Background" },
  { name: "surface" as const, label: "Surface" },
  { name: "text" as const, label: "Text" },
  { name: "textMuted" as const, label: "Text Muted" },
  { name: "border" as const, label: "Border" },
];

export function ThemeSection({ control, watch }: ThemeSectionProps) {
  const theme = watch("theme");

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
            Use CSS color values (e.g., hsl(210 50% 40%), #3b82f6)
          </p>
          <div className="grid grid-cols-2 gap-4">
            {CUSTOM_THEME_FIELDS.map(({ name, label }) => (
              <FormField
                key={name}
                control={control}
                name={`customTheme.${name}`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{label}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="hsl(0 0% 0%)"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Fonts</h3>

        <FormField
          control={control}
          name="fonts.heading"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Heading Font</FormLabel>
              <FormControl>
                <Input
                  placeholder="'Inter', system-ui, sans-serif"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                CSS font-family value for headings
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="fonts.body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Body Font</FormLabel>
              <FormControl>
                <Input
                  placeholder="'Inter', system-ui, sans-serif"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                CSS font-family value for body text
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="fonts.google"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Google Fonts</FormLabel>
              <FormControl>
                <Input
                  placeholder="Inter:wght@400;500;600;700"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormDescription>
                Google Fonts family parameter (the part after ?family=)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
