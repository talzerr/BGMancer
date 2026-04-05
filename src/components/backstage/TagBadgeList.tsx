import { Badge } from "@/components/ui/badge";

interface TagBadgeListProps {
  tags: string[];
  maxVisible?: number;
}

export function TagBadgeList({ tags, maxVisible = 3 }: TagBadgeListProps) {
  if (tags.length === 0) return <span className="text-[var(--text-disabled)]">—</span>;

  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - maxVisible;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((tag) => (
        <Badge
          key={tag}
          variant="outline"
          className="border-border bg-secondary/60 text-foreground px-1.5 py-0 font-mono text-[10px]"
        >
          {tag}
        </Badge>
      ))}
      {overflow > 0 && <span className="text-[10px] text-[var(--text-tertiary)]">+{overflow}</span>}
    </div>
  );
}
