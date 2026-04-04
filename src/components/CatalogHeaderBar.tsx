"use client";

enum FilterMode {
  All = "all",
  Favorites = "favorites",
}

interface CatalogHeaderBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  favoriteCount: number;
  filterMode: FilterMode;
  onFilterChange: (mode: FilterMode) => void;
}

export { FilterMode };

export function CatalogHeaderBar({
  search,
  onSearchChange,
  favoriteCount,
  filterMode,
  onFilterChange,
}: CatalogHeaderBarProps) {
  return (
    <div className="border-border flex items-center gap-3 border-b px-1 pb-2">
      <div className="flex gap-2">
        <button
          onClick={() => onFilterChange(FilterMode.All)}
          className={`text-[11px] font-medium transition-colors ${
            filterMode === FilterMode.All
              ? "text-foreground"
              : "hover:text-foreground text-[var(--text-tertiary)]"
          }`}
        >
          All
        </button>
        {favoriteCount > 0 && (
          <button
            onClick={() => onFilterChange(FilterMode.Favorites)}
            className={`text-[11px] font-medium transition-colors ${
              filterMode === FilterMode.Favorites
                ? "text-primary"
                : "hover:text-foreground text-[var(--text-tertiary)]"
            }`}
          >
            ★ {favoriteCount}
          </button>
        )}
      </div>

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
