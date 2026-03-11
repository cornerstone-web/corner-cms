"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSocialLinks } from "@/lib/actions/setup-steps";
import { EditComponent as IconPicker } from "@/fields/custom/icon/edit-component";

interface SocialLink {
  platform: string;
  url: string;
  label?: string;
  icon?: string;
}

const PRESET_PLATFORMS = [
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourchurch" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourchurch" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourchurch" },
  { key: "twitter", label: "X (Twitter)", placeholder: "https://x.com/yourchurch" },
  { key: "spotify", label: "Spotify", placeholder: "https://open.spotify.com/show/..." },
  { key: "applePodcasts", label: "Apple Podcasts", placeholder: "https://podcasts.apple.com/podcast/..." },
];

const PRESET_KEYS = new Set(PRESET_PLATFORMS.map((p) => p.key));

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialLinks?: SocialLink[];
}

export default function SocialStep({ church, onComplete, initialLinks = [] }: StepProps) {
  const getInitialUrl = (platform: string) =>
    initialLinks.find((l) => l.platform === platform)?.url ?? "";

  const [presets, setPresets] = useState<Record<string, string>>(() =>
    Object.fromEntries(PRESET_PLATFORMS.map((p) => [p.key, getInitialUrl(p.key)]))
  );

  const [customLinks, setCustomLinks] = useState<{ url: string; label: string; icon: string }[]>(() =>
    initialLinks
      .filter((l) => !PRESET_KEYS.has(l.platform))
      .map((l) => ({ url: l.url, label: l.label ?? "", icon: l.icon ?? "" }))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updatePreset(key: string, url: string) {
    setPresets((prev) => ({ ...prev, [key]: url }));
  }

  function addCustomLink() {
    setCustomLinks((prev) => [...prev, { url: "", label: "", icon: "" }]);
  }

  function updateCustomLink(index: number, field: "url" | "label" | "icon", value: string) {
    setCustomLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link))
    );
  }

  function removeCustomLink(index: number) {
    setCustomLinks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const links: SocialLink[] = [
        ...PRESET_PLATFORMS
          .filter((p) => presets[p.key]?.trim())
          .map((p) => ({ platform: p.key, url: presets[p.key].trim() })),
        ...customLinks
          .filter((l) => l.url.trim())
          .map((l, i) => ({
            platform: `custom-${i + 1}`,
            url: l.url.trim(),
            label: l.label.trim() || undefined,
            icon: l.icon || undefined,
          })),
      ];
      await saveSocialLinks(church.id, church.slug, links);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Social Media</h2>
        <p className="text-muted-foreground text-sm">
          Add links to your church&apos;s social profiles. All fields are optional.
        </p>
      </div>

      <div className="space-y-4">
        {PRESET_PLATFORMS.map((p) => (
          <div key={p.key} className="space-y-1.5">
            <Label htmlFor={`social-${p.key}`}>{p.label}</Label>
            <Input
              id={`social-${p.key}`}
              type="url"
              value={presets[p.key]}
              onChange={(e) => updatePreset(p.key, e.target.value)}
              placeholder={p.placeholder}
            />
          </div>
        ))}
      </div>

      {customLinks.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Custom Links</p>
          {customLinks.map((link, i) => (
            <div key={i} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Custom link {i + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeCustomLink(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input
                  type="url"
                  value={link.url}
                  onChange={(e) => updateCustomLink(i, "url", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Label</Label>
                  <Input
                    value={link.label}
                    onChange={(e) => updateCustomLink(i, "label", e.target.value)}
                    placeholder="e.g. Our Podcast"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Icon</Label>
                  <IconPicker
                    value={link.icon}
                    field={{ required: false }}
                    onChange={(icon: string) => updateCustomLink(i, "icon", icon)}
                    disabled={false}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCustomLink}
        className="flex items-center gap-1.5"
      >
        <Plus className="h-4 w-4" />
        Add custom link
      </Button>

      <div className="pt-2">
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? "Saving..." : "Continue →"}
        </Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
