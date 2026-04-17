"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface BuildProgressStepProps {
  church: { id: string };
  cfPagesUrl: string;
}

const STAGES = [
  { label: "Creating your site...", durationMs: 4000 },
  { label: "Configuring pages...", durationMs: 6000 },
  { label: "Building...", durationMs: 15000 },
  { label: "Almost there...", durationMs: 999999 },
];

export default function BuildProgressStep({ church, cfPagesUrl }: BuildProgressStepProps) {
  const router = useRouter();
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState("");

  // Stage advancement based on elapsed time
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const ms = Date.now() - start;
      let accumulated = 0;
      let idx = 0;
      for (const stage of STAGES) {
        accumulated += stage.durationMs;
        if (ms < accumulated) break;
        idx++;
      }
      setStageIndex(Math.min(idx, STAGES.length - 1));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Poll build status
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/setup/build-status?siteId=${church.id}`);
        const data = await res.json();

        if (data.status === "success") {
          router.push("/?launched=1");
          return;
        }

        if (data.status === "failure") {
          setError("Build failed. Please contact support.");
          return;
        }
      } catch {
        // Network error — keep polling
      }

      if (!cancelled) {
        setTimeout(poll, 5000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [church.id, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md px-6">
          <p className="text-destructive text-lg font-medium">{error}</p>
          <a
            href="mailto:support@cornerstoneweb.app"
            className="text-primary underline underline-offset-4 text-sm"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  const currentStage = STAGES[stageIndex];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-8 max-w-md px-6">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold tracking-tight">{currentStage.label}</h2>
          <p className="text-muted-foreground text-sm">This usually takes about 2–3 minutes.</p>
          {cfPagesUrl && (
            <p className="text-muted-foreground text-xs">
              Your site will be live at{" "}
              <span className="font-mono">{cfPagesUrl}</span>
            </p>
          )}
        </div>

        {/* Animated progress bar */}
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-primary rounded-full animate-pulse"
            style={{
              width: `${Math.min(
                20 + (stageIndex / (STAGES.length - 1)) * 70,
                90,
              )}%`,
              transition: "width 1s ease-in-out",
            }}
          />
        </div>

        {/* Stage dots */}
        <div className="flex justify-center gap-2">
          {STAGES.map((stage, i) => (
            <div
              key={stage.label}
              className={`w-2 h-2 rounded-full transition-colors duration-500 ${
                i <= stageIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
