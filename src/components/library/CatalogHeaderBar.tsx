"use client";

interface CatalogHeaderBarProps {
  search: string;
  onSearchChange: (value: string) => void;
}

export function CatalogHeaderBar({ search, onSearchChange }: CatalogHeaderBarProps) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-1 pb-2">
      <input
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Filter games..."
        className="border-border bg-secondary/60 text-foreground w-[160px] rounded-md border px-2.5 py-1 text-xs placeholder-[var(--text-disabled)] outline-none focus:border-[var(--border-emphasis)]"
      />
    </div>
  );
}
