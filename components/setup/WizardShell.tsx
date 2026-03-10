"use client";

import { useState } from "react";
import { getCurrentStep, getVisibleSteps, StepKey } from "./steps";
import WizardTimeline from "./WizardTimeline";
import BuildProgressStep from "./steps/BuildProgressStep";
import LaunchStep from "./steps/LaunchStep";
// Remaining step components will be imported here in Task 16

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
  const [launched, setLaunched] = useState<{ cfPagesUrl: string } | null>(null);

  function handleComplete(stepKey: StepKey) {
    const next = new Set(completedSteps);
    next.add(stepKey);
    setCompletedSteps(next);
    setCurrentStep(getCurrentStep(next));
  }

  // Post-launch: full-screen build progress replaces the entire wizard layout
  if (launched) {
    return <BuildProgressStep church={church} cfPagesUrl={launched.cfPagesUrl} />;
  }

  const visibleSteps = getVisibleSteps(completedSteps);

  function renderStep() {
    if (currentStep === "launched") {
      return (
        <LaunchStep
          church={church}
          completedSteps={completedSteps}
          onLaunched={(url) => setLaunched({ cfPagesUrl: url })}
        />
      );
    }

    // Step content placeholder — will be wired in Task 16
    return (
      <div className="rounded-lg border p-6 text-muted-foreground text-sm">
        Step: <strong>{currentStep}</strong>
      </div>
    );
  }

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
        {renderStep()}
      </main>
    </div>
  );
}
