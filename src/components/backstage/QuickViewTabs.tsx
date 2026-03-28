"use client";

import { cn } from "@/lib/utils";

export interface QuickViewTab {
  label: string;
  value: string;
  count?: number;
}

interface QuickViewTabsProps {
  tabs: QuickViewTab[];
  active: string;
  onChange: (value: string) => void;
}

export function QuickViewTabs({ tabs, active, onChange }: QuickViewTabsProps) {
  return (
    <div className="flex gap-1 border-b border-zinc-800">
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative px-3 py-2 text-xs font-medium transition-colors",
              isActive ? "text-violet-400" : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                {tab.count}
              </span>
            )}
            {isActive && <span className="absolute inset-x-0 -bottom-px h-px bg-violet-500" />}
          </button>
        );
      })}
    </div>
  );
}
