"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PLAYLIST_MODE_LABELS } from "@/lib/playlist-mode-labels";
import type { SessionSummary, PlaylistTelemetry } from "./theatre-constants";
import { PlaylistInspector } from "./_components/PlaylistInspector";
import { DirectorReference } from "./_components/DirectorReference";

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

  const handleFocus = useCallback(() => {
    if (!recentSessions) loadRecent();
  }, [recentSessions, loadRecent]);

  return (
    <div className="space-y-6">
      {/* Session Picker */}
      <div className="border-border bg-secondary/60 space-y-3 rounded-lg border p-4">
        <h2 className="text-[11px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
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
            className="border-border bg-secondary text-foreground h-8 flex-1 font-mono text-xs placeholder:text-[var(--text-disabled)]"
          />
          <Button
            size="sm"
            variant="outline"
            className="border-border text-foreground hover:text-foreground h-8 px-4 text-xs"
            onClick={() => playlistIdInput.trim() && loadPlaylist(playlistIdInput.trim())}
            disabled={loading || !playlistIdInput.trim()}
          >
            {loading ? "Loading..." : "Load"}
          </Button>
        </div>
        {error && <p className="text-xs text-rose-400">{error}</p>}

        {recentSessions && recentSessions.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] tracking-wider text-[var(--text-disabled)] uppercase">
              Recent sessions
            </p>
            {recentSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setPlaylistIdInput(s.id);
                  loadPlaylist(s.id);
                }}
                className="hover:bg-secondary/50 flex w-full items-center justify-between rounded px-2 py-1.5 text-left transition-colors"
              >
                <div className="min-w-0">
                  <span className="text-foreground flex items-center gap-2 truncate text-xs">
                    {s.name}
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      [{PLAYLIST_MODE_LABELS[s.playlist_mode].name}]
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-disabled)]">
                    {s.id.slice(0, 8)}
                  </span>
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <span className="font-mono text-[10px] text-[var(--text-tertiary)]">
                    {s.track_count} tracks
                  </span>
                  <span className="block font-mono text-[10px] text-[var(--text-disabled)]">
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
      <div className="border-border rounded-lg border">
        <button
          onClick={() => setRefOpen(!refOpen)}
          className="hover:bg-secondary/30 flex w-full items-center justify-between px-4 py-3 text-left transition-colors"
        >
          <span className="text-[11px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
            Director Reference
          </span>
          <span className="text-xs text-[var(--text-disabled)]">
            {refOpen ? "Collapse" : "Expand"}
          </span>
        </button>
        {refOpen && (
          <div className="border-border space-y-6 border-t px-4 py-4">
            <DirectorReference />
          </div>
        )}
      </div>
    </div>
  );
}
