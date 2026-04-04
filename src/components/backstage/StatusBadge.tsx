import { Badge } from "@/components/ui/badge";
import { OnboardingPhase } from "@/types";
import { cn } from "@/lib/utils";

const PHASE_STYLES: Record<OnboardingPhase, string> = {
  [OnboardingPhase.Draft]:
    "bg-[var(--surface-hover)]/50 text-muted-foreground border-[var(--border-emphasis)]",
  [OnboardingPhase.TracksLoaded]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  [OnboardingPhase.Tagged]: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  [OnboardingPhase.Resolved]: "bg-primary/10 text-primary border-primary/30",
  [OnboardingPhase.Failed]: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

interface StatusBadgeProps {
  phase: OnboardingPhase;
}

export function StatusBadge({ phase }: StatusBadgeProps) {
  const label = phase === OnboardingPhase.Tagged ? "Ready" : phase.replace("_", " ");
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", PHASE_STYLES[phase])}>
      {label}
    </Badge>
  );
}
