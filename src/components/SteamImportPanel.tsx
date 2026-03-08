"use client";

import { useMemo, useState } from "react";
import { Spinner, SearchIcon, ErrorCircle, CheckIcon } from "@/components/Icons";

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
}

const MIN_PLAYTIME_OPTIONS = [0, 1, 5, 10, 20, 50, 100] as const;

export function SteamImportPanel({ onImported }: { onImported: () => void }) {
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
          <div className="flex flex-col gap-2 pt-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && findGames()}
              placeholder="steamcommunity.com/id/yourname"
              disabled={loading}
              className="w-full rounded-lg bg-zinc-800/80 border border-white/[0.07] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={findGames}
              disabled={loading || !input.trim()}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-zinc-800 disabled:text-zinc-600 px-4 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? <Spinner className="w-3.5 h-3.5" /> : <SearchIcon className="w-3.5 h-3.5" />}
              Find Library
            </button>
          </div>

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
