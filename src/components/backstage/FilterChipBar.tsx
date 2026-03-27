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
            <span className="text-xs text-zinc-500">{def.label}</span>
            <Select
              value={current}
              onValueChange={(v) => onChange(def.key, !v || v === ANY ? "" : v)}
            >
              <SelectTrigger className="h-7 w-auto min-w-[80px] border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
                <span className="flex flex-1 text-left">{getDisplayLabel(def, current)}</span>
              </SelectTrigger>
              <SelectContent className="border-zinc-700 bg-zinc-900">
                <SelectItem value={ANY} className="text-xs text-zinc-400">
                  Any
                </SelectItem>
                {def.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs text-zinc-300">
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
          className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Reset
        </button>
      )}
    </div>
  );
}
