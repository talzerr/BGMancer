"use client";

import { useMemo } from "react";
import { ArcPhase } from "@/types";
import type { TrackDecision } from "@/types";
import { PHASE_COLORS, PHASE_TEXT, gameHue } from "../theatre-constants";
import { Section } from "./Section";

export function ArcTimeline({
  decisions,
  gameNames,
}: {
  decisions: TrackDecision[];
  gameNames: Record<string, string>;
}) {
  const phases = useMemo(() => {
    const groups: Record<string, TrackDecision[]> = {};
    for (const d of decisions) {
      (groups[d.arcPhase] ??= []).push(d);
    }
    return Object.values(ArcPhase)
      .filter((p) => groups[p])
      .map((p) => ({ phase: p, items: groups[p] }));
  }, [decisions]);

  return (
    <Section title="Arc Timeline">
      <div className="flex gap-0.5 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2">
        {phases.map(({ phase, items }) => (
          <div
            key={phase}
            className={`flex min-w-0 flex-1 flex-col rounded border px-1 py-1.5 ${PHASE_COLORS[phase] ?? "border-zinc-800 bg-zinc-900"}`}
          >
            <span
              className={`mb-1 text-center text-[9px] font-semibold uppercase ${PHASE_TEXT[phase] ?? "text-zinc-400"}`}
            >
              {phase}
            </span>
            <div className="flex flex-wrap justify-center gap-0.5">
              {items.map((d) => (
                <div
                  key={d.position}
                  title={`#${d.position} ${gameNames[d.gameId] ?? d.gameId.slice(0, 8)} — score: ${d.adjustedScore.toFixed(3)}`}
                  className="h-4 w-4 rounded-sm border border-zinc-700/50 text-center font-mono text-[8px] leading-4"
                  style={{
                    backgroundColor: `hsl(${gameHue(d.gameId)}, 40%, 25%)`,
                    color: `hsl(${gameHue(d.gameId)}, 50%, 70%)`,
                  }}
                >
                  {d.position}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {/* Legend — unique games */}
      <div className="mt-2 flex flex-wrap gap-2">
        {[...new Set(decisions.map((d) => d.gameId))].map((gid) => (
          <span key={gid} className="flex items-center gap-1 text-[10px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `hsl(${gameHue(gid)}, 40%, 35%)` }}
            />
            <span className="text-zinc-400">{gameNames[gid] ?? gid.slice(0, 8)}</span>
          </span>
        ))}
      </div>
    </Section>
  );
}
