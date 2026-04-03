"use client";

import { useMemo } from "react";
import type { TrackDecision } from "@/types";
import { gameHue } from "../theatre-constants";
import { Section } from "./Section";

export function GameDistribution({
  decisions,
  gameBudgets,
  gameNames,
}: {
  decisions: TrackDecision[];
  gameBudgets: Record<string, number>;
  gameNames: Record<string, string>;
}) {
  const distribution = useMemo(() => {
    const actual: Record<string, number> = {};
    for (const d of decisions) actual[d.gameId] = (actual[d.gameId] ?? 0) + 1;

    const allIds = [...new Set([...Object.keys(gameBudgets), ...Object.keys(actual)])];
    const maxVal = Math.max(
      ...allIds.map((id) => Math.max(gameBudgets[id] ?? 0, actual[id] ?? 0)),
      1,
    );

    return allIds
      .map((id) => ({
        gameId: id,
        name: gameNames[id] ?? id.slice(0, 8),
        budget: gameBudgets[id] ?? 0,
        actual: actual[id] ?? 0,
        maxVal,
      }))
      .sort((a, b) => b.actual - a.actual);
  }, [decisions, gameBudgets, gameNames]);

  return (
    <Section title="Game Distribution">
      <div className="space-y-2">
        {distribution.map((g) => (
          <div key={g.gameId} className="space-y-0.5">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-zinc-300">{g.name}</span>
              <span className="font-mono text-[10px] text-zinc-500">
                {g.actual}/{g.budget}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-zinc-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-700/50"
                style={{ width: `${(g.budget / g.maxVal) * 100}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${(g.actual / g.maxVal) * 100}%`,
                  backgroundColor: `hsl(${gameHue(g.gameId)}, 45%, 45%)`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
