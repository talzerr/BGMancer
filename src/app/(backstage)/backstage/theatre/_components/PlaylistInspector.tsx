"use client";

import { useMemo } from "react";
import type { PlaylistTelemetry } from "../theatre-constants";
import { ArcTimeline } from "./ArcTimeline";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { ScoreBreakdownTable } from "./ScoreBreakdownTable";
import { GameDistribution } from "./GameDistribution";
import { RubricDisplay } from "./RubricDisplay";

export function PlaylistInspector({ telemetry }: { telemetry: PlaylistTelemetry }) {
  const { session, tracks, decisions, gameBudgets, rubric } = telemetry;
  const gameNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of tracks) {
      if (t.game_title) map[t.game_id] = t.game_title;
    }
    return map;
  }, [tracks]);

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{session.name}</h3>
          <span className="font-mono text-[10px] text-zinc-600">
            {session.id} -- {session.created_at.slice(0, 16).replace("T", " ")}
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-500">{tracks.length} tracks</span>
      </div>

      <ArcTimeline decisions={decisions} gameNames={gameNames} />
      <DiagnosticsPanel decisions={decisions} gameNames={gameNames} />
      <ScoreBreakdownTable decisions={decisions} tracks={tracks} gameNames={gameNames} />
      {gameBudgets && (
        <GameDistribution decisions={decisions} gameBudgets={gameBudgets} gameNames={gameNames} />
      )}
      {rubric && <RubricDisplay rubric={rubric} />}
    </div>
  );
}
