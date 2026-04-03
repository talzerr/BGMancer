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
        <p className="mb-4 text-xs text-zinc-400">
          The Director assembles playlists in 6 phases, each targeting a fraction of the total track
          count with specific energy, role, and mood preferences.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARC_TEMPLATE.map((t) => (
            <div
              key={t.phase}
              className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-100 capitalize">{t.phase}</span>
                <span className="font-mono text-[11px] text-zinc-500">
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
                color="text-cyan-400"
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Scoring Weights */}
      <Section title="Scoring Weights">
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] tracking-wider text-zinc-500 uppercase">
                <th className="px-3 py-2 text-left">Dimension</th>
                <th className="px-3 py-2 text-left">Weight (raw vibes / view bias)</th>
                <th className="px-3 py-2 text-left">Method</th>
              </tr>
            </thead>
            <tbody>
              {SCORING_WEIGHTS.map((w) => (
                <tr key={w.dimension} className="border-b border-zinc-800/60">
                  <td className="px-3 py-2 font-semibold text-zinc-200">{w.dimension}</td>
                  <td className="px-3 py-2 font-mono text-violet-400">{w.weight}</td>
                  <td className="px-3 py-2 text-zinc-400">{w.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Budget Rules */}
      <Section title="Budget Allocation">
        <p className="mb-3 text-xs text-zinc-400">
          Each game&apos;s slot count = (curation weight / total weight) x target track count.
        </p>
        <div className="flex flex-wrap gap-3">
          {BUDGET_RULES.map((r) => (
            <div
              key={r.mode}
              className="flex items-baseline gap-2 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2"
            >
              <span className="text-xs text-zinc-300">{r.mode}</span>
              <span className={`font-mono text-sm font-semibold ${r.color}`}>{r.weight}</span>
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
              className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs"
            >
              <span className="font-semibold text-zinc-200">{p.name}</span>
              <span className="font-mono text-rose-400">{p.multiplier}</span>
              <span className="text-zinc-500">— {p.trigger}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Selection Parameters */}
      <Section title="Selection Parameters">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SELECTION_PARAMS.map((p) => (
            <div key={p.name} className="rounded border border-zinc-800 bg-zinc-900/60 px-3 py-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-zinc-300">{p.name}</span>
                <span className="font-mono text-sm font-semibold text-violet-400">{p.value}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500">{p.desc}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
