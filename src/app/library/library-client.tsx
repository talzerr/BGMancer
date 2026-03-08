"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Game, VibePreference } from "@/types";
import { VIBE_LABELS } from "@/types";
import { Spinner, TrashIcon, SearchIcon, ErrorCircle, CheckIcon } from "@/components/Icons";
import { AddGameForm } from "@/components/AddGameForm";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
}

type Filter = "all" | "active" | "disabled";
type SortKey = "playtime" | "name" | "added";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPlaytime(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return "Never played";
  if (minutes < 60) return "< 1 hr";
  return `${Math.round(minutes / 60)} hrs`;
}

function SteamCoverArt({ appid, title }: { appid: number; title: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="w-[46px] h-[22px] rounded bg-zinc-800 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`}
      alt={title}
      width={46}
      height={22}
      className="w-[46px] h-[22px] rounded object-cover shrink-0 bg-zinc-800"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-teal-500" : "bg-zinc-700"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ─── Game row ─────────────────────────────────────────────────────────────────

function GameRow({
  game,
  onToggle,
  onVibeChange,
  onDelete,
}: {
  game: Game;
  onToggle: (id: string, enabled: boolean) => void;
  onVibeChange: (id: string, vibe: VibePreference) => void;
  onDelete: (id: string) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const playtime = formatPlaytime(game.playtime_minutes);

  async function handleToggle(value: boolean) {
    setToggling(true);
    await onToggle(game.id, value);
    setToggling(false);
  }

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors ${
        game.enabled
          ? "bg-zinc-900/60 border-white/[0.07]"
          : "bg-zinc-950/60 border-white/[0.03] opacity-60"
      }`}
    >
      {/* Cover art */}
      {game.steam_appid ? (
        <SteamCoverArt appid={game.steam_appid} title={game.title} />
      ) : (
        <div className="w-[46px] h-[22px] rounded bg-zinc-800/60 shrink-0 flex items-center justify-center">
          <span className="text-[8px] text-zinc-600 font-bold">BGM</span>
        </div>
      )}

      {/* Title + playtime */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-100 truncate leading-tight">{game.title}</p>
        {playtime && (
          <p className="text-[11px] text-zinc-500 mt-0.5 leading-none">{playtime}</p>
        )}
      </div>

      {/* Vibe */}
      <select
        value={game.vibe_preference}
        onChange={(e) => onVibeChange(game.id, e.target.value as VibePreference)}
        className="rounded-lg bg-zinc-800/80 border border-white/[0.07] px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-teal-500/50 cursor-pointer appearance-none"
      >
        {(Object.entries(VIBE_LABELS) as [VibePreference, string][]).map(([v, label]) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>

      {/* Enable toggle */}
      <Toggle checked={game.enabled} onChange={handleToggle} disabled={toggling} />

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onDelete(game.id)}
            className="rounded-lg bg-red-600/90 hover:bg-red-500 px-2 py-1 text-xs font-medium text-white cursor-pointer"
          >
            Remove
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg bg-zinc-800 hover:bg-zinc-700 px-2 py-1 text-xs font-medium text-zinc-400 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          title="Remove game"
          className="shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-all"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}

// ─── Steam import panel ───────────────────────────────────────────────────────

const MIN_PLAYTIME_OPTIONS = [0, 1, 5, 10, 20, 50, 100] as const;

function SteamImportPanel({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [minPlaytimeHrs, setMinPlaytimeHrs] = useState(10);
  const [steamGames, setSteamGames] = useState<SteamGame[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const filteredGames = useMemo(
    () => steamGames?.filter((g) => g.playtime_forever >= minPlaytimeHrs * 60) ?? null,
    [steamGames, minPlaytimeHrs],
  );

  async function findGames() {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setSteamGames(null);
    setResult(null);

    try {
      const res = await fetch(`/api/steam/games?input=${encodeURIComponent(input.trim())}`);
      const data = await res.json() as { games?: SteamGame[]; error?: string };

      if (!res.ok) {
        if (data.error === "private") {
          setError("private");
        } else if (data.error === "not_found") {
          setError("Your Steam profile URL or username wasn't found. Check the URL and try again.");
        } else if (data.error === "missing_key") {
          setError("STEAM_API_KEY is not configured on the server.");
        } else {
          setError("Something went wrong fetching your Steam library.");
        }
        return;
      }

      setSteamGames(data.games ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function importFiltered() {
    if (!filteredGames || filteredGames.length === 0) return;
    setImporting(true);
    setError(null);

    try {
      const res = await fetch("/api/steam/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ games: filteredGames }),
      });
      const data = await res.json() as { imported?: number; skipped?: number; error?: string };

      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        return;
      }

      setResult({ imported: data.imported ?? 0, skipped: data.skipped ?? 0 });
      setSteamGames(null);
      setInput("");
      onImported();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] overflow-hidden backdrop-blur-sm shadow-lg shadow-black/40">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-teal-400 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.607 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.492 1.009 2.448-.397.957-1.497 1.41-2.454 1.019zm11.357-8.619c0-1.660-1.355-3.015-3.015-3.015-1.661 0-3.016 1.355-3.016 3.015 0 1.661 1.355 3.017 3.016 3.017 1.66 0 3.015-1.356 3.015-3.017zm-5.273.006c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
          </svg>
          <span className="text-sm font-semibold text-zinc-200">Import from Steam</span>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-5 pb-5 flex flex-col gap-4 border-t border-white/[0.05]">
          <div className="flex gap-2 pt-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findGames()}
              placeholder="steamcommunity.com/id/yourname"
              disabled={loading}
              className="flex-1 rounded-lg bg-zinc-800/80 border border-white/[0.07] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={findGames}
              disabled={loading || !input.trim()}
              className="flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? <Spinner className="w-3.5 h-3.5" /> : <SearchIcon className="w-3.5 h-3.5" />}
              Find Library
            </button>
          </div>

          {/* Min playtime filter — shown as soon as games are fetched */}
          {steamGames && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                  Min. playtime
                </label>
                <span className="text-xs font-semibold text-white tabular-nums">
                  {minPlaytimeHrs === 0 ? "All games" : `≥ ${minPlaytimeHrs} hrs`}
                  {filteredGames && (
                    <span className="text-zinc-500 font-normal ml-1.5">
                      ({filteredGames.length} of {steamGames.length})
                    </span>
                  )}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={MIN_PLAYTIME_OPTIONS.length - 1}
                step={1}
                value={MIN_PLAYTIME_OPTIONS.indexOf(minPlaytimeHrs as typeof MIN_PLAYTIME_OPTIONS[number]) === -1
                  ? 3
                  : MIN_PLAYTIME_OPTIONS.indexOf(minPlaytimeHrs as typeof MIN_PLAYTIME_OPTIONS[number])}
                onChange={(e) => setMinPlaytimeHrs(MIN_PLAYTIME_OPTIONS[Number(e.target.value)])}
                className="w-full accent-teal-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-600">
                {MIN_PLAYTIME_OPTIONS.map((v) => (
                  <span key={v}>{v === 0 ? "Any" : `${v}h`}</span>
                ))}
              </div>
            </div>
          )}

          {error === "private" && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-300">
              <p className="font-semibold mb-1">Your Steam profile is private.</p>
              <p className="text-amber-400/80">
                Go to Steam → Edit Profile → Privacy Settings → set <strong>Game details</strong> to Public, then try again.
              </p>
            </div>
          )}

          {error && error !== "private" && (
            <p className="flex items-center gap-1.5 text-sm text-red-400">
              <ErrorCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </p>
          )}

          {result && (
            <p className="flex items-center gap-1.5 text-sm text-teal-400">
              <CheckIcon className="w-3.5 h-3.5 shrink-0" />
              Imported {result.imported} game{result.imported !== 1 ? "s" : ""}
              {result.skipped > 0 && (
                <span className="text-zinc-500">(skipped {result.skipped} already in library)</span>
              )}
              . Sort by playtime below and enable the ones you want.
            </p>
          )}

          {filteredGames && filteredGames.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-400">
                <span className="font-semibold text-white">{filteredGames.length}</span> game{filteredGames.length !== 1 ? "s" : ""}
                {" "}will be added as <span className="text-zinc-500">disabled</span>
              </p>
              <button
                type="button"
                onClick={importFiltered}
                disabled={importing}
                className="flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white cursor-pointer disabled:cursor-not-allowed"
              >
                {importing && <Spinner className="w-3.5 h-3.5" />}
                Import as Disabled
              </button>
            </div>
          )}

          {filteredGames && filteredGames.length === 0 && steamGames && steamGames.length > 0 && (
            <p className="text-sm text-zinc-500 text-center py-1">
              No games meet the playtime threshold. Lower the slider to include more.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Main library client ──────────────────────────────────────────────────────

export function LibraryClient() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("playtime");
  const [search, setSearch] = useState("");
  const [enablingAll, setEnablingAll] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const res = await fetch("/api/games?includeDisabled=true");
      if (res.ok) setGames(await res.json());
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGames(); }, [fetchGames]);

  async function handleToggle(id: string, enabled: boolean) {
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, enabled } : g));
    try {
      await fetch(`/api/games?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
    } catch {
      setGames((prev) => prev.map((g) => g.id === id ? { ...g, enabled: !enabled } : g));
    }
  }

  async function handleVibeChange(id: string, vibe: VibePreference) {
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, vibe_preference: vibe } : g));
    try {
      await fetch(`/api/games?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibe_preference: vibe }),
      });
    } catch {
      // Ignore — the optimistic update is good enough for a quick toggle
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/games?id=${id}`, { method: "DELETE" });
      if (res.ok) setGames((prev) => prev.filter((g) => g.id !== id));
    } catch (err) {
      console.error("Failed to delete game:", err);
    }
  }

  const activeCount = games.filter((g) => g.enabled).length;
  const disabledCount = games.filter((g) => !g.enabled).length;

  const displayed = useMemo(() => {
    let list = [...games];

    if (filter === "active") list = list.filter((g) => g.enabled);
    else if (filter === "disabled") list = list.filter((g) => !g.enabled);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.title.toLowerCase().includes(q));
    }

    if (sort === "name") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sort === "playtime") {
      list.sort((a, b) => (b.playtime_minutes ?? -1) - (a.playtime_minutes ?? -1));
    }
    // "added" keeps the default server order (created_at ASC)

    return list;
  }, [games, filter, sort, search]);

  async function handleEnableAllShown() {
    const toEnable = displayed.filter((g) => !g.enabled);
    if (toEnable.length === 0) return;
    setEnablingAll(true);
    const ids = new Set(toEnable.map((g) => g.id));
    setGames((prev) => prev.map((g) => ids.has(g.id) ? { ...g, enabled: true } : g));
    await Promise.all(
      toEnable.map((g) =>
        fetch(`/api/games?id=${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        })
      )
    );
    setEnablingAll(false);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-2 inline-flex items-center gap-1"
            >
              ← BGMancer
            </Link>
            <h1 className="text-xl font-bold text-white">Game Library</h1>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white tabular-nums">{activeCount}</p>
            <p className="text-xs text-zinc-500">active</p>
          </div>
        </div>

        {/* Manual add */}
        <section className="rounded-2xl bg-zinc-900/70 border border-white/[0.07] p-5 backdrop-blur-sm shadow-lg shadow-black/40">
          <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-4">Add a Game</h2>
          <AddGameForm onGameAdded={() => { fetchGames(); }} />
        </section>

        {/* Steam import */}
        <SteamImportPanel onImported={fetchGames} />

        {/* Filter + sort + search */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {(
              [
                { key: "all" as Filter, label: `All (${games.length})` },
                { key: "active" as Filter, label: `Active (${activeCount})` },
                { key: "disabled" as Filter, label: `Disabled (${disabledCount})` },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  filter === key
                    ? "bg-zinc-700 text-white"
                    : "bg-zinc-900/60 border border-white/[0.07] text-zinc-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}

            {/* Enable all currently visible disabled games */}
            {displayed.some((g) => !g.enabled) && (
              <button
                onClick={handleEnableAllShown}
                disabled={enablingAll}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/30 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-teal-300 cursor-pointer disabled:cursor-not-allowed transition-colors"
              >
                {enablingAll ? <Spinner className="w-3 h-3" /> : <CheckIcon className="w-3 h-3" />}
                Enable all shown ({displayed.filter((g) => !g.enabled).length})
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-zinc-500">Sort:</span>
              {(
                [
                  { key: "added" as SortKey, label: "Added" },
                  { key: "playtime" as SortKey, label: "Playtime" },
                  { key: "name" as SortKey, label: "Name" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSort(key)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    sort === key
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search games…"
              className="w-full rounded-lg bg-zinc-800/60 border border-white/[0.07] pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
            />
          </div>
        </div>

        {/* Game list */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[52px] rounded-xl bg-zinc-900/40 animate-pulse" />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.07] p-8 text-center">
            {games.length === 0 ? (
              <>
                <p className="text-sm text-zinc-400 mb-1">No games in your library yet.</p>
                <p className="text-xs text-zinc-600">
                  Add games manually on the{" "}
                  <Link href="/" className="text-teal-400 hover:text-teal-300">main page</Link>
                  {" "}or import from Steam above.
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-500">No games match your filters.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {displayed.map((game) => (
              <GameRow
                key={game.id}
                game={game}
                onToggle={handleToggle}
                onVibeChange={handleVibeChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Tip when all disabled */}
        {!loading && games.length > 0 && activeCount === 0 && (
          <p className="text-xs text-center text-zinc-600">
            No active games — enable at least one to generate a playlist.
          </p>
        )}
      </div>
    </div>
  );
}
