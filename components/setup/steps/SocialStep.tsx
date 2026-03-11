"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSocialLinks } from "@/lib/actions/setup-steps";

interface StepProps {
  church: { id: string; displayName: string; slug: string };
  onComplete: () => void;
  initialSocial?: Record<string, string>;
}

export default function SocialStep({ church, onComplete, initialSocial }: StepProps) {
  const [youtube, setYoutube] = useState(initialSocial?.youtube ?? "");
  const [facebook, setFacebook] = useState(initialSocial?.facebook ?? "");
  const [instagram, setInstagram] = useState(initialSocial?.instagram ?? "");
  const [twitter, setTwitter] = useState(initialSocial?.twitter ?? "");
  const [spotify, setSpotify] = useState(initialSocial?.spotify ?? "");
  const [applePodcasts, setApplePodcasts] = useState(initialSocial?.applePodcasts ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const raw: Record<string, string> = {
        youtube,
        facebook,
        instagram,
        twitter,
        spotify,
        applePodcasts,
      };
      const links = Object.fromEntries(
        Object.entries(raw).filter(([, v]) => v.trim() !== ""),
      );
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
        <div className="space-y-1.5">
          <Label htmlFor="social-youtube">YouTube Channel URL</Label>
          <Input
            id="social-youtube"
            type="url"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            placeholder="https://youtube.com/@yourchurch"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="social-facebook">Facebook URL</Label>
          <Input
            id="social-facebook"
            type="url"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="https://facebook.com/yourchurch"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="social-instagram">Instagram URL</Label>
          <Input
            id="social-instagram"
            type="url"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="https://instagram.com/yourchurch"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="social-twitter">X (Twitter) URL</Label>
          <Input
            id="social-twitter"
            type="url"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="https://x.com/yourchurch"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="social-spotify">Spotify URL</Label>
          <Input
            id="social-spotify"
            type="url"
            value={spotify}
            onChange={(e) => setSpotify(e.target.value)}
            placeholder="https://open.spotify.com/show/..."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="social-apple-podcasts">Apple Podcasts URL</Label>
          <Input
            id="social-apple-podcasts"
            type="url"
            value={applePodcasts}
            onChange={(e) => setApplePodcasts(e.target.value)}
            placeholder="https://podcasts.apple.com/podcast/..."
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
