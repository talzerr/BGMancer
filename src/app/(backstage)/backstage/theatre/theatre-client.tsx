"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PlaylistTrack, TrackDecision, ScoringRubric, PlaylistSession } from "@/types";
import { SelectionPass } from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface SessionSummary extends PlaylistSession {
  track_count: number;
}

interface PlaylistTelemetry {
  session: { id: string; name: string; created_at: string };
  tracks: PlaylistTrack[];
  decisions: TrackDecision[];
  gameBudgets: Record<string, number> | null;
  rubric: ScoringRubric | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  intro: "bg-sky-900/40 border-sky-700/30",
  rising: "bg-amber-900/40 border-amber-700/30",
  peak: "bg-orange-900/40 border-orange-700/30",
  valley: "bg-emerald-900/40 border-emerald-700/30",
  climax: "bg-rose-900/40 border-rose-700/30",
  outro: "bg-violet-900/40 border-violet-700/30",
};

const PHASE_TEXT: Record<string, string> = {
  intro: "text-sky-400",
  rising: "text-amber-400",
  peak: "text-orange-400",
  valley: "text-emerald-400",
  climax: "text-rose-400",
  outro: "text-violet-400",
};

const PASS_STYLES: Record<string, { label: string; cls: string }> = {
  [SelectionPass.Scored]: {
    label: "scored",
    cls: "border-emerald-700/50 bg-emerald-500/10 text-emerald-400",
  },
  [SelectionPass.FocusPre]: {
    label: "focus",
    cls: "border-violet-700/50 bg-violet-500/10 text-violet-400",
  },
  [SelectionPass.Fallback]: {
    label: "fallback",
    cls: "border-amber-700/50 bg-amber-500/10 text-amber-400",
  },
  [SelectionPass.LastResort]: {
    label: "last resort",
    cls: "border-rose-700/50 bg-rose-500/10 text-rose-400",
  },
};

// Deterministic game color from gameId hash
function gameHue(gameId: string): number {
  let hash = 0;
  for (let i = 0; i < gameId.length; i++) hash = (hash * 31 + gameId.charCodeAt(i)) | 0;
  return Math.abs(hash) % 360;
}

// ─── Static reference data ──────────────────────────────────────────────────────

const ARC_PHASES = [
  {
    name: "Intro",
    fraction: 0.15,
    energy: [1, 2],
    roles: ["opener", "menu", "ambient"],
    moods: ["peaceful", "mysterious", "nostalgic"],
    penalizedMoods: ["chaotic", "epic"],
    instruments: ["piano", "ambient", "strings"],
  },
  {
    name: "Rising",
    fraction: 0.25,
    energy: [2],
    roles: ["build", "ambient", "cinematic"],
    moods: ["mysterious", "tense", "melancholic"],
    penalizedMoods: ["playful", "whimsical"],
    instruments: ["orchestral", "strings", "synth"],
  },
  {
    name: "Peak",
    fraction: 0.25,
    energy: [2, 3],
    roles: ["combat", "build", "cinematic"],
    moods: ["epic", "tense", "heroic"],
    penalizedMoods: ["peaceful", "serene", "whimsical"],
    instruments: ["orchestral", "rock", "metal"],
  },
  {
    name: "Valley",
    fraction: 0.15,
    energy: [1, 2],
    roles: ["ambient", "cinematic"],
    moods: ["peaceful", "serene", "melancholic"],
    penalizedMoods: ["epic", "chaotic", "heroic"],
    instruments: ["ambient", "piano", "acoustic"],
  },
  {
    name: "Climax",
    fraction: 0.1,
    energy: [3],
    roles: ["combat", "cinematic"],
    moods: ["epic", "heroic", "triumphant", "chaotic"],
    penalizedMoods: ["peaceful", "playful"],
    instruments: ["orchestral", "metal", "choir"],
  },
  {
    name: "Outro",
    fraction: 0.1,
    energy: [1],
    roles: ["closer", "ambient", "menu"],
    moods: ["melancholic", "nostalgic", "peaceful"],
    penalizedMoods: ["chaotic", "tense"],
    instruments: ["piano", "acoustic", "strings"],
  },
] as const;

const SCORING_WEIGHTS = [
  {
    dimension: "Role",
    weight: "0.40 / 0.30",
    method: "Binary -- 1.0 if role matches slot, 0.0 otherwise",
  },
  { dimension: "Mood", weight: "0.35 / 0.25", method: "Jaccard similarity on mood intersection" },
  {
    dimension: "Instrumentation",
    weight: "0.25 / 0.15",
    method: "Jaccard similarity on instrumentation intersection",
  },
  {
    dimension: "View Bias",
    weight: "— / 0.30",
    method: "YouTube view count popularity (global heat + local stature)",
  },
];

const BUDGET_RULES = [
  { mode: "Focus", weight: "2.0x", color: "text-violet-400" },
  { mode: "Include", weight: "1.0x", color: "text-zinc-300" },
  { mode: "Lite", weight: "0.5x", color: "text-zinc-500" },
  { mode: "Skip", weight: "excluded", color: "text-zinc-600" },
];

const PENALTIES = [
  { name: "Penalized mood", multiplier: "0.5x", trigger: "Track moods contain any penalized mood" },
  {
    name: "Vocals penalty",
    multiplier: "0.5x",
    trigger: "Rubric forbids vocals and track has them",
  },
  {
    name: "Same-game adjacency",
    multiplier: "-0.05",
    trigger: "Consecutive tracks from the same game",
  },
];

const SELECTION_PARAMS = [
  { name: "Top-N pool", value: "5", desc: "Candidates considered per slot" },
  { name: "Epsilon", value: "0.01", desc: "Added to avoid zero-weight picks" },
  { name: "Under-budget bonus", value: "+0.01/track", desc: "Bonus for under-represented games" },
  { name: "Tie-breaker noise", value: "+-0.005", desc: "Random noise to break score ties" },
  { name: "Per-game cap", value: "40%", desc: "No single game exceeds this fraction" },
];

const ENERGY_COLORS: Record<number, string> = {
  1: "bg-sky-500/20 text-sky-300 border-sky-500/30",
  2: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  3: "bg-rose-500/20 text-rose-300 border-rose-500/30",
};

// ─── Main Component ─────────────────────────────────────────────────────────────

export function TheatreClient() {
  const [playlistIdInput, setPlaylistIdInput] = useState("");
  const [recentSessions, setRecentSessions] = useState<SessionSummary[] | null>(null);
  const [telemetry, setTelemetry] = useState<PlaylistTelemetry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refOpen, setRefOpen] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch("/api/backstage/theatre/sessions");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as SessionSummary[];
      setRecentSessions(data);
    } catch (err) {
      console.error("[Theatre] Failed to load recent sessions:", err);
      setRecentSessions([]);
    }
  }, []);

  const loadPlaylist = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backstage/theatre/${id}`);
      if (!res.ok) {
        setError(`Session not found (HTTP ${res.status})`);
        setTelemetry(null);
        return;
      }
      const data = (await res.json()) as PlaylistTelemetry;
      setTelemetry(data);
    } catch (err) {
      console.error("[Theatre] Failed to load playlist:", err);
      setError("Failed to load session. Check your connection and try again.");
      setTelemetry(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load recent sessions on first interaction
  const handleFocus = useCallback(() => {
    if (!recentSessions) loadRecent();
  }, [recentSessions, loadRecent]);

  return (
    <div className="space-y-6">
      {/* Session Picker */}
      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          Playlist Inspector
        </h2>
        <div className="flex gap-2">
          <Input
            placeholder="Paste playlist ID..."
            value={playlistIdInput}
            onChange={(e) => setPlaylistIdInput(e.target.value)}
            onFocus={handleFocus}
            onKeyDown={(e) =>
              e.key === "Enter" && playlistIdInput.trim() && loadPlaylist(playlistIdInput.trim())
            }
            className="h-8 flex-1 border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 border-zinc-700 px-4 text-xs text-zinc-300 hover:text-zinc-100"
            onClick={() => playlistIdInput.trim() && loadPlaylist(playlistIdInput.trim())}
            disabled={loading || !playlistIdInput.trim()}
          >
            {loading ? "Loading..." : "Load"}
          </Button>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}

        {recentSessions && recentSessions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] tracking-wider text-zinc-600 uppercase">Recent sessions</p>
            {recentSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setPlaylistIdInput(s.id);
                  loadPlaylist(s.id);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors hover:bg-zinc-800/50"
              >
                <div className="min-w-0">
                  <span className="block truncate text-xs text-zinc-300">{s.name}</span>
                  <span className="font-mono text-[10px] text-zinc-600">{s.id.slice(0, 8)}</span>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <span className="font-mono text-[10px] text-zinc-500">
                    {s.track_count} tracks
                  </span>
                  <span className="block font-mono text-[10px] text-zinc-600">
                    {s.created_at.slice(0, 10)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loaded playlist */}
      {telemetry && <PlaylistInspector telemetry={telemetry} />}

      {/* Collapsible reference */}
      <div className="rounded-lg border border-zinc-800">
        <button
          onClick={() => setRefOpen(!refOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-800/30"
        >
          <span className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            Director Reference
          </span>
          <span className="text-xs text-zinc-600">{refOpen ? "Collapse" : "Expand"}</span>
        </button>
        {refOpen && (
          <div className="space-y-6 border-t border-zinc-800 px-4 py-4">
            <ReferenceContent />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Playlist Inspector ─────────────────────────────────────────────────────────

function PlaylistInspector({ telemetry }: { telemetry: PlaylistTelemetry }) {
  const { session, tracks, decisions, gameBudgets, rubric } = telemetry;
  const hasTelemetry = decisions.length > 0;

  // Build game title lookup from tracks
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

      {!hasTelemetry ? (
        <div className="rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-center">
          <p className="text-xs text-zinc-500">
            No telemetry available — this playlist was generated before Director telemetry was
            added.
          </p>
        </div>
      ) : (
        <>
          <ArcTimeline decisions={decisions} gameNames={gameNames} tracks={tracks} />
          <DiagnosticsPanel decisions={decisions} gameNames={gameNames} />
          <ScoreBreakdownTable decisions={decisions} tracks={tracks} gameNames={gameNames} />
          {gameBudgets && (
            <GameDistribution
              decisions={decisions}
              gameBudgets={gameBudgets}
              gameNames={gameNames}
            />
          )}
          {rubric && <RubricDisplay rubric={rubric} />}
        </>
      )}
    </div>
  );
}

// ─── Arc Timeline ───────────────────────────────────────────────────────────────

function ArcTimeline({
  decisions,
  gameNames,
  tracks,
}: {
  decisions: TrackDecision[];
  gameNames: Record<string, string>;
  tracks: PlaylistTrack[];
}) {
  // Group decisions by phase
  const phases = useMemo(() => {
    const groups: Record<string, TrackDecision[]> = {};
    for (const d of decisions) {
      (groups[d.arcPhase] ??= []).push(d);
    }
    // Return in arc order
    return ["intro", "rising", "peak", "valley", "climax", "outro"]
      .filter((p) => groups[p])
      .map((p) => ({ phase: p, items: groups[p] }));
  }, [decisions]);

  // Track energy lookup
  const trackEnergy = useMemo(() => {
    const map: Record<number, number | null> = {};
    for (const t of tracks) {
      // Find decision for this position to get energy from the track
      map[t.position] = null;
    }
    // We don't have energy in decisions, get from tracks tags... but playlist_tracks don't store energy.
    // We'll show it as position label only.
    return map;
  }, [tracks]);
  void trackEnergy; // energy not available on playlist_tracks

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

// ─── Diagnostics Panel ──────────────────────────────────────────────────────────

interface Diagnostic {
  severity: "warning" | "info";
  message: string;
}

function DiagnosticsPanel({
  decisions,
  gameNames,
}: {
  decisions: TrackDecision[];
  gameNames: Record<string, string>;
}) {
  const diagnostics = useMemo(() => {
    const issues: Diagnostic[] = [];

    // Same-game runs >= 3
    let runLength = 1;
    for (let i = 1; i < decisions.length; i++) {
      if (decisions[i].gameId === decisions[i - 1].gameId) {
        runLength++;
      } else {
        if (runLength >= 3) {
          const gid = decisions[i - 1].gameId;
          const name = gameNames[gid] ?? gid.slice(0, 8);
          issues.push({
            severity: "warning",
            message: `${runLength}-track run from "${name}" at positions ${i - runLength}-${i - 1}`,
          });
        }
        runLength = 1;
      }
    }
    if (runLength >= 3) {
      const gid = decisions[decisions.length - 1].gameId;
      const name = gameNames[gid] ?? gid.slice(0, 8);
      issues.push({
        severity: "warning",
        message: `${runLength}-track run from "${name}" at end of playlist`,
      });
    }

    // Low-score selections
    const lowScoreCount = decisions.filter((d) => d.adjustedScore < 0.1).length;
    if (lowScoreCount > 0) {
      issues.push({
        severity: "warning",
        message: `${lowScoreCount} track${lowScoreCount > 1 ? "s" : ""} with adjusted score < 0.1`,
      });
    }

    // Fallback / last resort
    const fallbackCount = decisions.filter(
      (d) =>
        d.selectionPass === SelectionPass.Fallback || d.selectionPass === SelectionPass.LastResort,
    ).length;
    if (fallbackCount > 0) {
      issues.push({
        severity: "info",
        message: `${fallbackCount} track${fallbackCount > 1 ? "s" : ""} placed via fallback/last-resort`,
      });
    }

    // Budget exhaustion
    const exhausted = new Set<string>();
    for (const d of decisions) {
      if (d.gameBudgetUsed >= d.gameBudget && d.gameBudget > 0) exhausted.add(d.gameId);
    }
    if (exhausted.size > 0) {
      const names = [...exhausted].map((id) => gameNames[id] ?? id.slice(0, 8)).join(", ");
      issues.push({
        severity: "info",
        message: `Budget fully consumed for: ${names}`,
      });
    }

    return issues;
  }, [decisions, gameNames]);

  return (
    <Section title="Diagnostics">
      {diagnostics.length === 0 ? (
        <p className="text-xs text-emerald-500">No issues detected.</p>
      ) : (
        <div className="space-y-1">
          {diagnostics.map((d, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                d.severity === "warning"
                  ? "bg-amber-900/10 text-amber-400"
                  : "bg-zinc-800/30 text-zinc-400"
              }`}
            >
              <span className="shrink-0">{d.severity === "warning" ? "!" : "i"}</span>
              <span>{d.message}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Score Breakdown Table ───────────────────────────────────────────────────────

function ScoreBreakdownTable({
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
              <TableHead className="w-10 text-[10px] tracking-wider text-zinc-500 uppercase">
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
                    <ScoreCell value={d.viewBiasScore} />
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

// ─── Game Distribution ──────────────────────────────────────────────────────────

function GameDistribution({
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
              {/* Budget bar */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-zinc-700/50"
                style={{ width: `${(g.budget / g.maxVal) * 100}%` }}
              />
              {/* Actual bar */}
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

// ─── Rubric Display ─────────────────────────────────────────────────────────────

function RubricDisplay({ rubric }: { rubric: ScoringRubric }) {
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

// ─── Reference Content (collapsible) ────────────────────────────────────────────

function ReferenceContent() {
  return (
    <>
      {/* Arc Template */}
      <Section title="Arc Template">
        <p className="mb-4 text-xs text-zinc-400">
          The Director assembles playlists in 6 phases, each targeting a fraction of the total track
          count with specific energy, role, and mood preferences.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARC_PHASES.map((phase) => (
            <div
              key={phase.name}
              className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-zinc-100">{phase.name}</span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {Math.round(phase.fraction * 100)}%
                </span>
              </div>
              <div className="flex gap-1">
                {phase.energy.map((e) => (
                  <span
                    key={e}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${ENERGY_COLORS[e]}`}
                  >
                    E{e}
                  </span>
                ))}
              </div>
              <TagGroup label="Roles" tags={phase.roles} />
              <TagGroup label="Moods" tags={phase.moods} color="text-emerald-400" />
              <TagGroup label="Penalized" tags={phase.penalizedMoods} color="text-rose-400" />
              <TagGroup label="Instruments" tags={phase.instruments} color="text-cyan-400" />
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
                <th className="px-3 py-2 text-left">Weight (legacy / view bias)</th>
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

// ─── Shared Components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}

function TagGroup({
  label,
  tags,
  color = "text-zinc-300",
}: {
  label: string;
  tags: readonly string[];
  color?: string;
}) {
  return (
    <div>
      <span className="text-[10px] tracking-wider text-zinc-600 uppercase">{label}</span>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className={`font-mono text-[10px] ${color}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
