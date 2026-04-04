"use client";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";

export interface FilterDef {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

export interface ActiveFilter {
  key: string;
  value: string;
}

interface FilterBarProps {
  filters: ActiveFilter[];
  definitions: FilterDef[];
  onChange: (key: string, value: string) => void;
  onReset?: () => void;
}

// Sentinel used internally — base-ui Select doesn't support empty-string values.
const ANY = "\x00any";

export function FilterChipBar({ filters, definitions, onChange, onReset }: FilterBarProps) {
  const hasActiveFilters = filters.length > 0;

  function getValue(key: string): string {
    return filters.find((f) => f.key === key)?.value ?? ANY;
  }

  function getDisplayLabel(def: FilterDef, value: string): string {
    if (value === ANY) return "Any";
    return def.options.find((o) => o.value === value)?.label ?? value;
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {definitions.map((def) => {
        const current = getValue(def.key);
        return (
          <div key={def.key} className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-tertiary)]">{def.label}</span>
            <Select
              value={current}
              onValueChange={(v) => onChange(def.key, !v || v === ANY ? "" : v)}
            >
              <SelectTrigger className="border-border bg-secondary text-foreground h-7 w-auto min-w-[80px] px-2 text-xs">
                <span className="flex flex-1 text-left">{getDisplayLabel(def, current)}</span>
              </SelectTrigger>
              <SelectContent className="border-border bg-secondary">
                <SelectItem value={ANY} className="text-muted-foreground text-xs">
                  Any
                </SelectItem>
                {def.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-foreground text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
      {hasActiveFilters && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="hover:text-foreground text-xs text-[var(--text-tertiary)] transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}
