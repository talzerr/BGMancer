"use client";

import type { ScoringRubric } from "@/types";
import { Section } from "./Section";

function RubricCard({ label, items, color }: { label: string; items: string[]; color: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
      <span className="text-[10px] tracking-wider text-zinc-600 uppercase">{label}</span>
      <div className="mt-1 flex flex-wrap gap-1">
        {items.map((item) => (
          <span key={item} className={`font-mono text-[10px] ${color}`}>
            {item}
          </span>
        ))}
        {items.length === 0 && <span className="text-[10px] text-zinc-600">none</span>}
      </div>
    </div>
  );
}

export function RubricDisplay({ rubric }: { rubric: ScoringRubric }) {
  return (
    <Section title="Vibe Rubric">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RubricCard label="Preferred Roles" items={rubric.preferredRoles} color="text-violet-400" />
        <RubricCard
          label="Preferred Moods"
          items={rubric.preferredMoods}
          color="text-emerald-400"
        />
        <RubricCard label="Penalized Moods" items={rubric.penalizedMoods} color="text-rose-400" />
        <RubricCard
          label="Preferred Instruments"
          items={rubric.preferredInstrumentation}
          color="text-cyan-400"
        />
        <RubricCard
          label="Penalized Instruments"
          items={rubric.penalizedInstrumentation}
          color="text-rose-400"
        />
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
          <span className="text-[10px] tracking-wider text-zinc-600 uppercase">Vocals</span>
          <p className="mt-1 text-xs text-zinc-300">
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
