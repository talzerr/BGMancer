"use client";

import { ARC_TEMPLATE } from "@/lib/pipeline/generation/director";
import {
  SCORING_WEIGHTS,
  BUDGET_RULES,
  PENALTIES,
  SELECTION_PARAMS,
  ENERGY_COLORS,
} from "../theatre-constants";
import { Section } from "./Section";
import { TagGroup } from "./TagGroup";

export function DirectorReference() {
  return (
    <>
      {/* Arc Template */}
      <Section title="Arc Template">
        <p className="text-muted-foreground mb-4 text-xs">
          The Director assembles playlists in 6 phases, each targeting a fraction of the total track
          count with specific energy, role, and mood preferences.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARC_TEMPLATE.map((t) => (
            <div
              key={t.phase}
              className="border-border bg-secondary/60 space-y-2 rounded-lg border p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground text-sm font-medium capitalize">{t.phase}</span>
                <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                  {Math.round(t.fraction * 100)}%
                </span>
              </div>
              <div className="flex gap-1">
                {t.energyPrefs.map((e) => (
                  <span
                    key={e}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${ENERGY_COLORS[e]}`}
                  >
                    E{e}
                  </span>
                ))}
              </div>
              <TagGroup label="Roles" tags={t.rolePrefs} />
              <TagGroup label="Moods" tags={t.preferredMoods} color="text-emerald-400" />
              <TagGroup label="Penalized" tags={t.penalizedMoods} color="text-rose-400" />
              <TagGroup
                label="Instruments"
                tags={t.preferredInstrumentation}
                color="text-primary"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Scoring Weights */}
      <Section title="Scoring Weights">
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-border border-b text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                <th className="px-3 py-2 text-left">Dimension</th>
                <th className="px-3 py-2 text-left">Weight (raw vibes / view bias)</th>
                <th className="px-3 py-2 text-left">Method</th>
              </tr>
            </thead>
            <tbody>
              {SCORING_WEIGHTS.map((w) => (
                <tr key={w.dimension} className="border-border/60 border-b">
                  <td className="text-foreground px-3 py-2 font-medium">{w.dimension}</td>
                  <td className="text-primary px-3 py-2 font-mono">{w.weight}</td>
                  <td className="text-muted-foreground px-3 py-2">{w.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Budget Rules */}
      <Section title="Budget Allocation">
        <p className="text-muted-foreground mb-3 text-xs">
          Each game&apos;s slot count = (curation weight / total weight) x target track count.
        </p>
        <div className="flex flex-wrap gap-3">
          {BUDGET_RULES.map((r) => (
            <div
              key={r.mode}
              className="border-border bg-secondary/60 flex items-baseline gap-2 rounded border px-3 py-2"
            >
              <span className="text-foreground text-xs">{r.mode}</span>
              <span className={`font-mono text-sm font-medium ${r.color}`}>{r.weight}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Penalties */}
      <Section title="Penalties">
        <div className="space-y-2">
          {PENALTIES.map((p) => (
            <div
              key={p.name}
              className="border-border bg-secondary/60 flex items-center gap-3 rounded border px-3 py-2 text-xs"
            >
              <span className="text-foreground font-medium">{p.name}</span>
              <span className="font-mono text-rose-400">{p.multiplier}</span>
              <span className="text-[var(--text-tertiary)]">— {p.trigger}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Selection Parameters */}
      <Section title="Selection Parameters">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SELECTION_PARAMS.map((p) => (
            <div key={p.name} className="border-border bg-secondary/60 rounded border px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-foreground text-xs">{p.name}</span>
                <span className="text-primary font-mono text-sm font-medium">{p.value}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
