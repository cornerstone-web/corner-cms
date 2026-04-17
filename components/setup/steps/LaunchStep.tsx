"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { launchSite } from "@/lib/actions/setup";
import type { WizardFeatures } from "@/lib/wizard/nav-gen";
import type { HomeGenOptions } from "@/lib/wizard/home-gen";
import { STEP_GROUPS } from "@/components/setup/steps";

interface LaunchStepProps {
  church: { id: string; displayName: string; slug: string };
  completedSteps: Set<string>;
  onLaunched: (cfPagesUrl: string) => void;
}

export default function LaunchStep({ church, completedSteps, onLaunched }: LaunchStepProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLaunch() {
    setIsLoading(true);
    setError("");

    const features: WizardFeatures = {
      sermons: completedSteps.has("sermons"),
      series: completedSteps.has("series"),
      ministries: completedSteps.has("ministries"),
      events: completedSteps.has("events"),
      articles: completedSteps.has("articles"),
      staff: completedSteps.has("staff"),
      bulletins: completedSteps.has("bulletins"),
      leadership: completedSteps.has("leadership"),
      givingUrl: undefined,
    };

    const homeOpts: HomeGenOptions = {
      heroImage: completedSteps.has("hero") ? "/uploads/hero.jpg" : undefined,
      photos: completedSteps.has("photos"),
      sermons: features.sermons,
      ministries: features.ministries,
      events: features.events,
      articles: features.articles,
      streaming: completedSteps.has("streaming"),
    };

    const result = await launchSite({ siteId: church.id, features, homeOpts });

    if (!result.ok) {
      setError(result.error ?? "Launch failed. Please try again.");
      setIsLoading(false);
      return;
    }

    onLaunched(result.cfPagesUrl ?? "");
  }

  // Build per-group completion summaries (skip "launch" group itself)
  const summaryGroups = STEP_GROUPS.filter((g) => g.key !== "launch").map((group) => {
    const completedInGroup = group.steps.filter(
      (s) => completedSteps.has(s.key) && (!s.showWhen || completedSteps.has(s.showWhen)),
    );
    return { group, completedInGroup };
  }).filter(({ completedInGroup }) => completedInGroup.length > 0);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold">🎉 You&apos;re Ready to Launch!</h2>
        <p className="text-muted-foreground">
          Here&apos;s what we&apos;ve set up for <strong>{church.displayName}</strong>:
        </p>
      </div>

      <div className="space-y-6">
        {summaryGroups.map(({ group, completedInGroup }) => (
          <div key={group.key} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {group.label}
            </h3>
            <ul className="space-y-1">
              {completedInGroup.map((step) => (
                <li key={step.key} className="flex items-center gap-2 text-sm">
                  <span className="text-green-600 font-medium">✓</span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <Button onClick={handleLaunch} disabled={isLoading} size="lg">
          {isLoading ? "Launching..." : "Launch Your Site →"}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </div>
  );
}
