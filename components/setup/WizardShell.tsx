"use client";

import { useState } from "react";
import { getCurrentStep, getVisibleSteps, StepKey } from "./steps";
import WizardTimeline from "./WizardTimeline";
// Step components will be imported here in Task 16 — use a placeholder for now

interface WizardShellProps {
  church: {
    id: string;
    displayName: string;
    slug: string;
  };
  completedStepsArray: string[];
}

export default function WizardShell({ church, completedStepsArray }: WizardShellProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(
    () => new Set(completedStepsArray)
  );
  const [currentStep, setCurrentStep] = useState<StepKey>(() => getCurrentStep(new Set(completedStepsArray)));

  function handleComplete(stepKey: StepKey) {
    const next = new Set(completedSteps);
    next.add(stepKey);
    setCompletedSteps(next);
    setCurrentStep(getCurrentStep(next));
  }

  const visibleSteps = getVisibleSteps(completedSteps);

  return (
    <div className="flex min-h-screen bg-background">
      <WizardTimeline
        visibleSteps={visibleSteps}
        completedSteps={completedSteps}
        currentStep={currentStep}
        onNavigate={setCurrentStep}
      />
      <main className="flex-1 p-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Setting Up {church.displayName}</h1>
        </div>
        {/* Step content placeholder — will be wired in Task 16 */}
        <div className="rounded-lg border p-6 text-muted-foreground text-sm">
          Step: <strong>{currentStep}</strong>
        </div>
      </main>
    </div>
  );
}
