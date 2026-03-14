"use client";

import { useState } from "react";
import { Spinner, CheckIcon } from "@/components/Icons";

export function SeedExportPanel() {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [exported, setExported] = useState<number | null>(null);

  async function handleExport() {
    setState("loading");
    try {
      const res = await fetch("/api/seed/yt-playlists");
      const entries = (await res.json()) as Array<{ game_title: string; playlist_id: string }>;
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "yt-playlists.json";
      a.click();
      URL.revokeObjectURL(url);
      setExported(entries.length);
      setState("done");
      setTimeout(() => setState("idle"), 3000);
    } catch {
      setState("idle");
    }
  }

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-zinc-900/70 px-5 py-4 shadow-lg shadow-black/40 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h2 className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase">
              Playlist Seed
            </h2>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-400/80 uppercase">
              Dev
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            Snapshot discovered playlists so they survive a DB reset.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={state !== "idle"}
          className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed ${
            state === "done"
              ? "border-teal-500/30 bg-teal-600/10 text-teal-400"
              : "border-white/[0.07] bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700/80 hover:text-white disabled:opacity-50"
          }`}
        >
          {state === "loading" && <Spinner className="h-3 w-3" />}
          {state === "done" && <CheckIcon className="h-3 w-3" />}
          {state === "done"
            ? `Exported ${exported} entr${exported === 1 ? "y" : "ies"}`
            : "Export Seed"}
        </button>
      </div>
    </section>
  );
}
