"use client";

import { useState } from "react";
import { MAX_TRACK_COUNT } from "@/lib/constants";

interface CustomSizeRowProps {
  value: number;
  isCustom: boolean;
  onChange: (n: number) => void;
}

export function CustomSizeRow({ value, isCustom, onChange }: CustomSizeRowProps) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  function commit() {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v >= 1 && v <= MAX_TRACK_COUNT && v !== value) {
      onChange(v);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <div className="flex items-center justify-between">
      <span
        className={`text-[12px] transition-colors ${
          isCustom ? "text-[var(--text-secondary)]" : "text-[var(--text-disabled)]"
        }`}
      >
        Custom size
      </span>
      <input
        type="number"
        min={1}
        max={MAX_TRACK_COUNT}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Custom playlist size"
        className="focus:border-primary/60 w-14 [appearance:textfield] rounded-md border border-[var(--border-default)] bg-transparent px-2 py-1 text-center text-[11px] text-[var(--text-secondary)] tabular-nums focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
}
