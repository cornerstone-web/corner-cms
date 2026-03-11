"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_GROUPS, StepDef, StepKey } from "./steps";

interface WizardTimelineProps {
  visibleSteps: StepDef[];
  completedSteps: Set<string>;
  currentStep: StepKey;
  onNavigate: (step: StepKey) => void;
  className?: string;
}

export default function WizardTimeline({ visibleSteps, completedSteps, currentStep, onNavigate, className }: WizardTimelineProps) {
  const visibleKeys = new Set(visibleSteps.map(s => s.key));

  return (
    <aside className={cn("w-56 border-r bg-muted/30 p-4 flex flex-col gap-4 shrink-0 overflow-y-auto", className)}>
      {STEP_GROUPS.map(group => {
        const groupSteps = group.steps.filter(s => visibleKeys.has(s.key));
        if (groupSteps.length === 0) return null;

        return (
          <div key={group.key}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {groupSteps.map(step => {
                const isCompleted = completedSteps.has(step.key);
                const isCurrent = currentStep === step.key;
                const isClickable = isCompleted; // can revisit completed steps

                return (
                  <li key={step.key}>
                    <button
                      onClick={() => isClickable && onNavigate(step.key)}
                      disabled={!isClickable && !isCurrent}
                      className={cn(
                        "flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm text-left transition-colors",
                        isCurrent && "bg-primary/10 text-primary font-medium",
                        isCompleted && !isCurrent && "text-foreground hover:bg-accent cursor-pointer",
                        !isCompleted && !isCurrent && "text-muted-foreground cursor-default"
                      )}
                    >
                      <span className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                        isCompleted && "border-primary bg-primary text-primary-foreground",
                        isCurrent && !isCompleted && "border-primary",
                        !isCompleted && !isCurrent && "border-muted-foreground/40"
                      )}>
                        {isCompleted ? <Check className="h-2.5 w-2.5" /> : null}
                      </span>
                      {step.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}
