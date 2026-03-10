"use client";

import { useState, useEffect } from "react";
import { usePlayerContext } from "@/context/player-context";
import { TrackStatus } from "@/types";

type Tab = "config" | "playlist" | "player" | "yt-playlists";

interface RawConfigRow {
  key: string;
  value: string;
  updated_at: string;
}

interface RawYtPlaylistRow {
  game_id: string;
  game_title: string;
  playlist_id: string;
  discovered_at: string;
}

const STATUS_BADGE: Record<TrackStatus, string> = {
  [TrackStatus.Found]: "bg-emerald-900/60 text-emerald-300 border-emerald-700/50",
  [TrackStatus.Pending]: "bg-zinc-800 text-zinc-400 border-zinc-700",
  [TrackStatus.Searching]: "bg-amber-900/60 text-amber-300 border-amber-700/50",
  [TrackStatus.Error]: "bg-red-900/60 text-red-300 border-red-700/50",
};

export function DevPanel() {
  const { playlist, player } = usePlayerContext();
  const [activeTab, setActiveTab] = useState<Tab>("config");
  const [configRows, setConfigRows] = useState<RawConfigRow[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [ytRows, setYtRows] = useState<RawYtPlaylistRow[]>([]);
  const [ytLoading, setYtLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dev/config")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        setConfigRows(rows);
        setConfigLoading(false);
      })
      .catch(() => setConfigLoading(false));

    fetch("/api/dev/yt-playlists")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        setYtRows(rows);
        setYtLoading(false);
      })
      .catch(() => setYtLoading(false));
  }, []);

  const tracks = playlist.tracks;
  const byStatus = {
    found: tracks.filter((t) => t.status === TrackStatus.Found).length,
    pending: tracks.filter((t) => t.status === TrackStatus.Pending).length,
    searching: tracks.filter((t) => t.status === TrackStatus.Searching).length,
    error: tracks.filter((t) => t.status === TrackStatus.Error).length,
  };
  const pct = tracks.length > 0 ? Math.round((byStatus.found / tracks.length) * 100) : 0;

  const tabs: { id: Tab; label: string }[] = [
    { id: "config", label: "config" },
    { id: "playlist", label: "playlist" },
    { id: "player", label: "player" },
    { id: "yt-playlists", label: "yt-playlists" },
  ];

  return (
    <details className="mt-6 rounded-xl border border-white/[0.06] bg-zinc-950/80 font-mono text-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-zinc-500 transition-colors select-none hover:text-zinc-300">
        <span className="text-base">🔧</span>
        <span className="font-semibold">Dev</span>
        <span className="ml-auto text-zinc-600">
          {byStatus.found}/{tracks.length} loaded · {pct}%
        </span>
      </summary>

      <div className="border-t border-white/[0.06]">
        {/* Tab bar */}
        <div className="flex border-b border-white/[0.06]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer px-4 py-2 text-[11px] font-medium transition-colors ${
                activeTab === tab.id
                  ? "-mb-px border-b-2 border-violet-500 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* ── Config tab ──────────────────────────────────────────────── */}
          {activeTab === "config" &&
            (configLoading ? (
              <p className="text-zinc-600">loading…</p>
            ) : configRows.length === 0 ? (
              <p className="text-zinc-600">No rows in config table.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-zinc-900/80 text-left text-zinc-500">
                      <th className="px-3 py-2">key</th>
                      <th className="px-3 py-2">value</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">updated_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configRows.map((row) => (
                      <tr
                        key={row.key}
                        className="border-t border-white/[0.04] hover:bg-zinc-900/40"
                      >
                        <td className="px-3 py-1.5 text-violet-300">{row.key}</td>
                        <td className="px-3 py-1.5 text-emerald-300">{row.value}</td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-zinc-600">
                          {row.updated_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {/* ── Playlist tab ────────────────────────────────────────────── */}
          {activeTab === "playlist" &&
            (tracks.length === 0 ? (
              <p className="text-zinc-600">No tracks in playlist.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      TrackStatus.Found,
                      TrackStatus.Pending,
                      TrackStatus.Searching,
                      TrackStatus.Error,
                    ] as const
                  ).map(
                    (s) =>
                      byStatus[s] > 0 && (
                        <span
                          key={s}
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${STATUS_BADGE[s]}`}
                        >
                          <span className="font-bold tabular-nums">{byStatus[s]}</span> {s}
                        </span>
                      ),
                  )}
                </div>
                <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-zinc-900/80 text-left text-zinc-500">
                        <th className="w-8 px-2 py-1.5">#</th>
                        <th className="px-2 py-1.5">game</th>
                        <th className="px-2 py-1.5">status</th>
                        <th className="px-2 py-1.5">video_id</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tracks.map((t, i) => (
                        <tr
                          key={t.id}
                          className={`border-t border-white/[0.04] ${t.id === player.playingTrackId ? "bg-violet-950/30" : "hover:bg-zinc-900/40"}`}
                        >
                          <td className="px-2 py-1 text-zinc-600 tabular-nums">{i + 1}</td>
                          <td className="max-w-[160px] truncate px-2 py-1 text-zinc-400">
                            {t.game_title ?? t.game_id}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] ${STATUS_BADGE[t.status] ?? STATUS_BADGE[TrackStatus.Pending]}`}
                            >
                              {t.status}
                            </span>
                          </td>
                          <td className="px-2 py-1 tabular-nums">
                            {t.video_id ? (
                              <span className="text-emerald-400">✓ {t.video_id.slice(0, 6)}…</span>
                            ) : (
                              <span className="text-zinc-600">✗</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ))}

          {/* ── Player tab ──────────────────────────────────────────────── */}
          {activeTab === "player" && (
            <pre className="overflow-x-auto rounded-lg bg-zinc-900/80 px-3 py-2 leading-relaxed text-zinc-300">
              {JSON.stringify(
                {
                  currentTrackIndex: player.currentTrackIndex,
                  playingTrackId: player.playingTrackId,
                  isPlaying: player.isPlayerPlaying,
                  shuffleMode: player.shuffleMode,
                },
                null,
                2,
              )}
            </pre>
          )}

          {/* ── YT Playlists tab ────────────────────────────────────────── */}
          {activeTab === "yt-playlists" &&
            (ytLoading ? (
              <p className="text-zinc-600">loading…</p>
            ) : ytRows.length === 0 ? (
              <p className="text-zinc-600">No cached YT playlists.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-zinc-900/80 text-left text-zinc-500">
                      <th className="px-3 py-2">game</th>
                      <th className="px-3 py-2">playlist_id</th>
                      <th className="px-3 py-2 text-right whitespace-nowrap">discovered_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ytRows.map((row) => (
                      <tr
                        key={row.game_id}
                        className="border-t border-white/[0.04] hover:bg-zinc-900/40"
                      >
                        <td className="max-w-[160px] truncate px-3 py-1.5 text-zinc-300">
                          {row.game_title}
                        </td>
                        <td className="px-3 py-1.5 text-emerald-300 tabular-nums">
                          {row.playlist_id}
                        </td>
                        <td className="px-3 py-1.5 text-right whitespace-nowrap text-zinc-600">
                          {row.discovered_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
        </div>
      </div>
    </details>
  );
}
