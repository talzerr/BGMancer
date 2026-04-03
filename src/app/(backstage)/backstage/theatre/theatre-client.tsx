"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
            <DirectorReference />
          </div>
        )}
      </div>
    </div>
  );
}
