"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TrackRole, TrackMood, TrackInstrumentation } from "@/types";
import type { Track } from "@/types";
import { cn } from "@/lib/utils";

export interface VideoMeta {
  videoId: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
}

interface TrackEditSheetProps {
  track: Track | null;
  videoMeta?: VideoMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (gameId: string, name: string, updates: PatchUpdates) => Promise<void>;
}

export interface PatchUpdates {
  name?: string;
  energy?: number | null;
  roles?: string | null;
  moods?: string | null;
  instrumentation?: string | null;
  hasVocals?: boolean | null;
  active?: boolean;
  videoId?: string;
  durationSeconds?: number | null;
  viewCount?: number | null;
}

const ROLES = Object.values(TrackRole);
const MOODS = Object.values(TrackMood);
const INSTRUMENTATIONS = Object.values(TrackInstrumentation);

function ToggleChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
        active
          ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
          : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300",
      )}
    >
      {label}
    </button>
  );
}

export function TrackEditSheet({
  track,
  videoMeta,
  open,
  onOpenChange,
  onSave,
}: TrackEditSheetProps) {
  const [energy, setEnergy] = useState<number | null>(track?.energy ?? null);
  const [roles, setRoles] = useState<string[]>(track?.roles ?? []);
  const [moods, setMoods] = useState<string[]>(track?.moods ?? []);
  const [instrumentation, setInstrumentation] = useState<string[]>(track?.instrumentation ?? []);
  const [hasVocals, setHasVocals] = useState<boolean | null>(track?.hasVocals ?? null);
  const [active, setActive] = useState<boolean>(track?.active ?? true);
  const [videoId, setVideoId] = useState<string>(videoMeta?.videoId ?? "");
  const [durationSeconds, setDurationSeconds] = useState<string>(
    videoMeta?.durationSeconds != null ? String(videoMeta.durationSeconds) : "",
  );
  const [viewCount, setViewCount] = useState<string>(
    videoMeta?.viewCount != null ? String(videoMeta.viewCount) : "",
  );
  const [saving, setSaving] = useState(false);

  function toggleSet<T extends string>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
  }

  async function handleSave() {
    if (!track) return;
    setSaving(true);
    try {
      const updates: PatchUpdates = {
        energy,
        roles: JSON.stringify(roles),
        moods: JSON.stringify(moods),
        instrumentation: JSON.stringify(instrumentation),
        hasVocals,
        active,
      };
      if (videoId.trim()) {
        updates.videoId = videoId.trim();
        updates.durationSeconds = durationSeconds ? Number(durationSeconds) : null;
        updates.viewCount = viewCount ? Number(viewCount) : null;
      }
      await onSave(track.gameId, track.name, updates);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] overflow-y-auto border-zinc-800 bg-zinc-900 p-0"
      >
        <SheetHeader className="border-b border-zinc-800 px-5 py-4">
          <SheetTitle className="truncate font-sans text-sm text-zinc-100">
            {track?.name ?? ""}
          </SheetTitle>
          <p className="font-mono text-[11px] text-zinc-500">
            pos {track?.position ?? "—"} ·{" "}
            {track?.taggedAt ? `tagged ${track.taggedAt.slice(0, 10)}` : "untagged"}
          </p>
        </SheetHeader>

        {track && (
          <div className="space-y-5 px-5 py-5">
            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={active}
                onCheckedChange={(v) => setActive(!!v)}
                className="border-zinc-600"
              />
              <label htmlFor="active" className="cursor-pointer text-xs text-zinc-300">
                Active (included in playlists)
              </label>
            </div>

            {/* Energy */}
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider text-zinc-500 uppercase">Energy</p>
              <div className="flex gap-2">
                {([1, 2, 3] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setEnergy(energy === lvl ? null : lvl)}
                    className={cn(
                      "rounded border px-3 py-1 font-mono text-xs transition-colors",
                      energy === lvl
                        ? lvl === 1
                          ? "border-sky-500/50 bg-sky-500/20 text-sky-300"
                          : lvl === 2
                            ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                            : "border-rose-500/50 bg-rose-500/20 text-rose-300"
                        : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600",
                    )}
                  >
                    {lvl}
                  </button>
                ))}
                {energy !== null && (
                  <button
                    type="button"
                    onClick={() => setEnergy(null)}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
                Role <span className="text-zinc-600 normal-case">(select 1-2)</span>
              </p>
              <Select value={roles[0] ?? ""} onValueChange={(v) => setRoles(v ? [v] : [])}>
                <SelectTrigger className="border-zinc-700 bg-zinc-800 text-xs text-zinc-200">
                  <SelectValue placeholder="Select role…" />
                </SelectTrigger>
                <SelectContent className="border-zinc-700 bg-zinc-900">
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs text-zinc-300">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Moods */}
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
                Moods <span className="text-zinc-600 normal-case">(up to 3)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <ToggleChip
                    key={m}
                    label={m}
                    active={moods.includes(m)}
                    onToggle={() => {
                      const next = toggleSet(moods, m);
                      if (next.length <= 3 || moods.includes(m)) setMoods(next);
                    }}
                  />
                ))}
              </div>
              {moods.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {moods.map((m) => (
                    <Badge
                      key={m}
                      variant="outline"
                      className="border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300"
                    >
                      {m}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Instrumentation */}
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider text-zinc-500 uppercase">
                Instrumentation <span className="text-zinc-600 normal-case">(up to 3)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {INSTRUMENTATIONS.map((inst) => (
                  <ToggleChip
                    key={inst}
                    label={inst}
                    active={instrumentation.includes(inst)}
                    onToggle={() => {
                      const next = toggleSet(instrumentation, inst);
                      if (next.length <= 3 || instrumentation.includes(inst))
                        setInstrumentation(next);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Vocals */}
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider text-zinc-500 uppercase">Vocals</p>
              <div className="flex gap-2">
                {[true, false, null].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setHasVocals(v)}
                    className={cn(
                      "rounded border px-2 py-0.5 text-xs transition-colors",
                      hasVocals === v
                        ? "border-violet-500/50 bg-violet-500/20 text-violet-300"
                        : "border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-600",
                    )}
                  >
                    {v === null ? "unknown" : v ? "yes" : "no"}
                  </button>
                ))}
              </div>
            </div>

            {/* Video metadata */}
            <div className="space-y-1.5">
              <p className="text-[11px] tracking-wider text-zinc-500 uppercase">Video</p>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-500">Video ID</label>
                  <Input
                    value={videoId}
                    onChange={(e) => setVideoId(e.target.value)}
                    placeholder="e.g. dQw4w9WgXcQ"
                    className="h-7 border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-zinc-500">Duration (sec)</label>
                    <Input
                      value={durationSeconds}
                      onChange={(e) => setDurationSeconds(e.target.value.replace(/\D/g, ""))}
                      placeholder="180"
                      className="h-7 border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] text-zinc-500">View count</label>
                    <Input
                      value={viewCount}
                      onChange={(e) => setViewCount(e.target.value.replace(/\D/g, ""))}
                      placeholder="1000"
                      className="h-7 border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-200 placeholder:text-zinc-600"
                    />
                  </div>
                </div>
                {durationSeconds && (
                  <p className="font-mono text-[10px] text-zinc-600">
                    {Math.floor(Number(durationSeconds) / 60)}:
                    {String(Number(durationSeconds) % 60).padStart(2, "0")}
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex gap-2 border-t border-zinc-800 pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-xs text-zinc-400"
                onClick={() => onOpenChange(false)}
              >
                Discard
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-violet-600 text-xs text-white hover:bg-violet-700"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
