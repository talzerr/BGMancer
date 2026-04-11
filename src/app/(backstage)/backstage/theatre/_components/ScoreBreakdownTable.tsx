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
      className={`font-mono text-[10px] ${highlight ? "font-medium" : ""}`}
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

  return (
    <Section title="Score Breakdown">
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-8 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                #
              </TableHead>
              <TableHead className="text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Phase
              </TableHead>
              <TableHead className="text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Game
              </TableHead>
              <TableHead className="text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Track
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Role
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Mood
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Inst
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Views
              </TableHead>
              <TableHead className="w-12 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Final
              </TableHead>
              <TableHead className="w-12 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Adj
              </TableHead>
              <TableHead className="w-10 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Pool
              </TableHead>
              <TableHead className="w-14 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Budget
              </TableHead>
              <TableHead className="w-16 text-[10px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Pass
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {decisions.map((d) => {
              const track = trackByPos[d.position];
              const passStyle = PASS_STYLES[d.selectionPass] ?? PASS_STYLES[SelectionPass.Scored];
              return (
                <TableRow key={d.position} className="border-border/60 hover:bg-secondary/20">
                  <TableCell className="py-1.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                    {d.position}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span
                      className={`text-[10px] font-medium uppercase ${PHASE_TEXT[d.arcPhase] ?? "text-muted-foreground"}`}
                    >
                      {d.arcPhase}
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground py-1.5 text-[11px]">
                    {gameNames[d.gameId] ?? d.gameId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-foreground max-w-[180px] truncate py-1.5 text-[11px]">
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
                    <ScoreCell value={d.viewBiasScore} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.finalScore} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ScoreCell value={d.adjustedScore} highlight />
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                    {d.poolSize}
                  </TableCell>
                  <TableCell className="py-1.5 font-mono text-[10px] text-[var(--text-tertiary)]">
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
