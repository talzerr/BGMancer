"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectionPass } from "@/types";
import type { PlaylistTrack, TrackDecision } from "@/types";
import { PHASE_TEXT, PASS_STYLES } from "../theatre-constants";
import { Section } from "./Section";

function ScoreCell({ value, highlight }: { value: number; highlight?: boolean }) {
  const opacity = Math.max(0.3, Math.min(1, value));
  return (
    <span
      className={`font-mono text-[10px] ${highlight ? "font-semibold" : ""}`}
      style={{ color: `rgba(${highlight ? "167, 139, 250" : "161, 161, 170"}, ${opacity})` }}
    >
      {value.toFixed(2)}
    </span>
  );
}

export function ScoreBreakdownTable({
  decisions,
  tracks,
  gameNames,
}: {
  decisions: TrackDecision[];
  tracks: PlaylistTrack[];
  gameNames: Record<string, string>;
}) {
  const trackByPos = useMemo(() => {
    const map: Record<number, PlaylistTrack> = {};
    for (const t of tracks) map[t.position] = t;
    return map;
  }, [tracks]);

  const hasViewBias = decisions.some((d) => d.viewBiasActive);

  return (
    <Section title="Score Breakdown">
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-transparent">
              <TableHead className="w-8 text-[10px] tracking-wider text-zinc-500 uppercase">
                #
              </TableHead>
              <TableHead className="text-[10px] tracking-wider text-zinc-500 uppercase">
                Phase
              </TableHead>
              <TableHead className="text-[10px] tracking-wider text-zinc-500 uppercase">
                Game
              </TableHead>
              <TableHead className="text-[10px] tracking-wider text-zinc-500 uppercase">
                Track
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-zinc-500 uppercase">
                Role
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-zinc-500 uppercase">
                Mood
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-zinc-500 uppercase">
                Inst
              </TableHead>
              <TableHead
                className={`w-10 text-[10px] tracking-wider uppercase ${hasViewBias ? "text-zinc-500" : "text-zinc-700"}`}
                title={
                  hasViewBias ? undefined : "View bias was off for this session (raw vibes mode)"
                }
              >
                Views
              </TableHead>
              <TableHead className="w-12 text-[10px] tracking-wider text-zinc-500 uppercase">
                Final
              </TableHead>
              <TableHead className="w-12 text-[10px] tracking-wider text-zinc-500 uppercase">
                Adj
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-zinc-500 uppercase">
                Pool
              </TableHead>
              <TableHead className="w-14 text-[10px] tracking-wider text-zinc-500 uppercase">
                Budget
              </TableHead>
              <TableHead className="w-16 text-[10px] tracking-wider text-zinc-500 uppercase">
                Pass
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((d) => {
              const track = trackByPos[d.position];
              const passStyle = PASS_STYLES[d.selectionPass] ?? PASS_STYLES[SelectionPass.Scored];
              return (
                <TableRow key={d.position} className="border-zinc-800/60 hover:bg-zinc-800/20">
                  <TableCell className="py-1.5 font-mono text-[10px] text-zinc-500">
                    {d.position}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span
                      className={`text-[10px] font-semibold uppercase ${PHASE_TEXT[d.arcPhase] ?? "text-zinc-400"}`}
                    >
                      {d.arcPhase}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-[11px] text-zinc-300">
                    {gameNames[d.gameId] ?? d.gameId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate py-1.5 text-[11px] text-zinc-200">
                    {track?.track_name ?? track?.video_title ?? "—"}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.roleScore} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.moodScore} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.instScore} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    {d.viewBiasActive ? (
                      <ScoreCell value={d.viewBiasScore} />
                    ) : (
                      <span className="font-mono text-[10px] text-zinc-700">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.finalScore} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.adjustedScore} highlight />
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-[10px] text-zinc-500">
                    {d.poolSize}
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-[10px] text-zinc-500">
                    {d.gameBudgetUsed}/{d.gameBudget}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge variant="outline" className={`text-[9px] ${passStyle.cls}`}>
                      {passStyle.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Section>
  );
}
