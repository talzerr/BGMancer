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
    <div className="border-border flex gap-1 border-b">
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              "relative px-3 py-2 text-xs font-medium transition-colors",
              isActive ? "text-primary" : "hover:text-foreground text-[var(--text-tertiary)]",
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="bg-secondary text-muted-foreground ml-1.5 rounded px-1.5 py-0.5 font-mono text-[10px]">
                {tab.count}
              </span>
            )}
            {isActive && <span className="bg-primary absolute inset-x-0 -bottom-px h-px" />}
          </button>
        );
      })}
    </div>
  );
}
