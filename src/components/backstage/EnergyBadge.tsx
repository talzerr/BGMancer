import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ENERGY_STYLES: Record<number, string> = {
  1: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  2: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  3: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const ENERGY_LABELS: Record<number, string> = {
  1: "Calm",
  2: "Moderate",
  3: "Intense",
};

interface EnergyBadgeProps {
  energy: 1 | 2 | 3 | null;
  showLabel?: boolean;
}

export function EnergyBadge({ energy, showLabel = false }: EnergyBadgeProps) {
  if (energy === null) {
    return (
      <Badge
        variant="outline"
        className="border-zinc-700 bg-zinc-800/50 font-mono text-xs text-zinc-500"
      >
        —
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={cn("font-mono text-xs", ENERGY_STYLES[energy])}>
      {energy}
      {showLabel && <span className="ml-1 font-sans">{ENERGY_LABELS[energy]}</span>}
    </Badge>
  );
}
