import { Badge } from "@/components/ui/badge";
import { OnboardingPhase } from "@/types";
import { cn } from "@/lib/utils";

const PHASE_STYLES: Record<OnboardingPhase, string> = {
  [OnboardingPhase.Draft]: "bg-zinc-700/50 text-zinc-400 border-zinc-600",
  [OnboardingPhase.TracksLoaded]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  [OnboardingPhase.Tagged]: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  [OnboardingPhase.Resolved]: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  [OnboardingPhase.Failed]: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

interface StatusBadgeProps {
  phase: OnboardingPhase;
}

export function StatusBadge({ phase }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", PHASE_STYLES[phase])}>
      {phase.replace("_", " ")}
    </Badge>
  );
}
