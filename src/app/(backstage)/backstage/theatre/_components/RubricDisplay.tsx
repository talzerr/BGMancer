"use client";

import type { ScoringRubric } from "@/types";
import { Section } from "./Section";

function RubricCard({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="border-border bg-secondary/60 rounded-lg border p-3">
      <span className="text-[10px] tracking-wider text-[var(--text-disabled)] uppercase">
        {label}
      </span>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className={`font-mono text-[10px] ${color}`}>
            {item}
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-[10px] text-[var(--text-disabled)]">none</span>
        )}
      </div>
    </div>
  );
}

export function RubricDisplay({ rubric }: { rubric: ScoringRubric }) {
  return (
    <Section title="Vibe Rubric">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RubricCard label="Preferred Roles" items={rubric.preferredRoles} color="text-primary" />
        <RubricCard
          label="Preferred Moods"
          items={rubric.preferredMoods}
          color="text-emerald-400"
        />
        <RubricCard label="Penalized Moods" items={rubric.penalizedMoods} color="text-rose-400" />
        <RubricCard
          label="Preferred Instruments"
          items={rubric.preferredInstrumentation}
          color="text-primary"
        />
        <RubricCard
          label="Penalized Instruments"
          items={rubric.penalizedInstrumentation}
          color="text-rose-400"
        />
        <div className="border-border bg-secondary/60 rounded-lg border p-3">
          <span className="text-[10px] tracking-wider text-[var(--text-disabled)] uppercase">
            Vocals
          </span>
          <p className="text-foreground mt-1 text-xs">
            {rubric.allowVocals === null
              ? "No preference"
              : rubric.allowVocals
                ? "Allowed"
                : "Penalized"}
          </p>
        </div>
      </div>
    </Section>
  );
}
