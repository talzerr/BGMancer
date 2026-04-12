import { OnboardingPhase } from "@/types";
import { cn } from "@/lib/utils";

const STEPS = [
  { phase: OnboardingPhase.Draft, label: "Draft" },
  { phase: OnboardingPhase.TracksLoaded, label: "Tracks Loaded" },
  { phase: OnboardingPhase.Resolved, label: "Resolved" },
  { phase: OnboardingPhase.Tagged, label: "Tagged" },
] as const;

const PHASE_ORDER: Record<string, number> = {
  [OnboardingPhase.Draft]: 0,
  [OnboardingPhase.TracksLoaded]: 1,
  [OnboardingPhase.Resolved]: 2,
  [OnboardingPhase.Tagged]: 3,
  [OnboardingPhase.Failed]: -1,
};

interface PhaseStepperProps {
  currentPhase: OnboardingPhase;
  published: boolean;
}

export function PhaseStepper({ currentPhase, published }: PhaseStepperProps) {
  const isFailed = currentPhase === OnboardingPhase.Failed;
  const currentOrder = PHASE_ORDER[currentPhase] ?? -1;

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const stepOrder = PHASE_ORDER[step.phase];
        const isCompleted = !isFailed && stepOrder < currentOrder;
        const isCurrent = step.phase === currentPhase;

        return (
          <div key={step.phase} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-4",
                  isCompleted ? "bg-primary/60" : "bg-[var(--text-disabled)]",
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium",
                  isCompleted && "bg-primary/15 text-primary",
                  isCurrent && !isFailed && "bg-primary text-primary-foreground",
                  isCurrent && isFailed && "bg-rose-500 text-white",
                  !isCompleted && !isCurrent && "bg-secondary text-[var(--text-disabled)]",
                )}
              >
                {isCompleted ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium",
                  isCompleted && "text-muted-foreground",
                  isCurrent && !isFailed && "text-primary",
                  isCurrent && isFailed && "text-rose-400",
                  !isCompleted && !isCurrent && "text-[var(--text-disabled)]",
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}

      {published && (
        <>
          <div className="h-px w-4 bg-emerald-500/60" />
          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            Published
          </span>
        </>
      )}

      {isFailed && <span className="ml-2 text-[10px] font-medium text-rose-400">Failed</span>}
    </div>
  );
}
