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
    <div className="flex items-center gap-3 border-b border-white/[0.04] px-1 pb-2">
      <div className="flex gap-2">
        <button
          onClick={() => onFilterChange(FilterMode.All)}
          className={`text-[11px] font-medium transition-colors ${
            filterMode === FilterMode.All ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          All
        </button>
        {favoriteCount > 0 && (
          <button
            onClick={() => onFilterChange(FilterMode.Favorites)}
            className={`text-[11px] font-medium transition-colors ${
              filterMode === FilterMode.Favorites
                ? "text-amber-400"
                : "text-zinc-500 hover:text-zinc-300"
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
        className="w-[160px] rounded-md border border-white/[0.06] bg-zinc-900/60 px-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-white/[0.12]"
      />
    </div>
  );
}
