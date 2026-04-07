"use client";

import { ArcPhase } from "@/types";
import type { VibeRubric } from "@/types";
import { Section } from "./Section";
import { PHASE_TEXT } from "../theatre-constants";

const PHASE_LABELS: Record<ArcPhase, string> = {
  [ArcPhase.Intro]: "Intro",
  [ArcPhase.Rising]: "Rising",
  [ArcPhase.Peak]: "Peak",
  [ArcPhase.Valley]: "Valley",
  [ArcPhase.Climax]: "Climax",
  [ArcPhase.Outro]: "Outro",
};

function Tag({ label, color }: { label: string; color: string }) {
  return <span className={`font-mono text-[10px] ${color}`}>{label}</span>;
}

export function RubricDisplay({ rubric }: { rubric: VibeRubric }) {
  return (
    <Section title="Vibe Rubric">
      {/* Per-phase overrides */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(ArcPhase).map((phase) => {
          const override = rubric.phases[phase];
          return (
            <div key={phase} className="border-border bg-secondary/60 rounded-lg border p-3">
              <span
                className={`text-[10px] font-semibold tracking-wider uppercase ${PHASE_TEXT[phase] ?? "text-foreground"}`}
              >
                {PHASE_LABELS[phase]}
              </span>
              {override ? (
                <div className="mt-1.5 flex flex-col gap-1">
                  <div className="flex flex-wrap gap-1">
                    {override.preferredMoods.map((m) => (
                      <Tag key={m} label={m} color="text-emerald-400" />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {override.preferredInstrumentation.map((i) => (
                      <Tag key={i} label={i} color="text-primary" />
                    ))}
                  </div>
                  {override.preferredRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {override.preferredRoles.map((r) => (
                        <Tag key={r} label={r} color="text-sky-400" />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-[10px] text-[var(--text-disabled)]">default</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Global fields */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="border-border bg-secondary/60 rounded-lg border p-3">
          <span className="text-[10px] tracking-wider text-[var(--text-disabled)] uppercase">
            Penalized Moods
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {rubric.penalizedMoods.map((m) => (
              <Tag key={m} label={m} color="text-rose-400" />
            ))}
            {rubric.penalizedMoods.length === 0 && (
              <span className="text-[10px] text-[var(--text-disabled)]">none</span>
            )}
          </div>
        </div>

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
