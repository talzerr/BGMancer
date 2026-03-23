import { Badge } from "@/components/ui/badge";
import { TaggingStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TaggingStatus, string> = {
  [TaggingStatus.Pending]: "bg-zinc-700/50 text-zinc-400 border-zinc-600",
  [TaggingStatus.Indexing]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  [TaggingStatus.Ready]: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  [TaggingStatus.Limited]: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  [TaggingStatus.Failed]: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

interface StatusBadgeProps {
  status: TaggingStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("text-xs capitalize", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}
