"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddGameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (game: { id: string; title: string }) => void;
}

export function AddGameDialog({ open, onOpenChange, onCreated }: AddGameDialogProps) {
  const [newTitle, setNewTitle] = useState("");
  const [newSteamAppid, setNewSteamAppid] = useState("");
  const [creating, setCreating] = useState(false);
  const [steamQuery, setSteamQuery] = useState("");
  const [steamResults, setSteamResults] = useState<
    { appid: number; name: string; tiny_image: string }[]
  >([]);
  const [steamSearching, setSteamSearching] = useState(false);
  const steamDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    setNewTitle("");
    setNewSteamAppid("");
    setSteamQuery("");
    setSteamResults([]);
  }

  function handleSteamSearch(query: string) {
    setSteamQuery(query);
    if (steamDebounceRef.current) clearTimeout(steamDebounceRef.current);
    if (query.trim().length < 2) {
      setSteamResults([]);
      return;
    }
    steamDebounceRef.current = setTimeout(async () => {
      setSteamSearching(true);
      try {
        const res = await fetch(`/api/steam/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as {
            results?: { appid: number; name: string; tiny_image: string }[];
          };
          setSteamResults(data.results ?? []);
        }
      } catch {
        /* non-critical */
      } finally {
        setSteamSearching(false);
      }
    }, 300);
  }

  function selectSteamResult(result: { appid: number; name: string }) {
    setNewTitle(result.name);
    setNewSteamAppid(String(result.appid));
    setSteamQuery("");
    setSteamResults([]);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/backstage/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          steamAppid: newSteamAppid ? Number(newSteamAppid) : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const game = (await res.json()) as { id: string; title: string };
      onOpenChange(false);
      reset();
      onCreated(game);
    } catch (err) {
      console.error("[AddGameDialog] create failed:", err);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="border-border bg-secondary sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Add Game</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Steam search */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs">Search Steam</label>
            <Input
              value={steamQuery}
              onChange={(e) => handleSteamSearch(e.target.value)}
              placeholder="Type to search Steam..."
              className="border-border bg-background text-foreground placeholder:text-[var(--text-disabled)]"
              autoFocus
            />
            {steamSearching && (
              <p className="text-[11px] text-[var(--text-tertiary)]">Searching…</p>
            )}
            {steamResults.length > 0 && (
              <div className="border-border bg-secondary/80 max-h-48 overflow-y-auto rounded border">
                {steamResults.map((r) => (
                  <button
                    key={r.appid}
                    type="button"
                    onClick={() => selectSteamResult(r)}
                    className="text-foreground flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-[var(--surface-hover)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.tiny_image}
                      alt=""
                      className="h-[22px] w-[30px] shrink-0 rounded object-cover"
                    />
                    <span className="min-w-0 truncate">{r.name}</span>
                    <span className="ml-auto shrink-0 font-mono text-[10px] text-[var(--text-tertiary)]">
                      {r.appid}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-border h-px flex-1" />
            <span className="text-[10px] text-[var(--text-disabled)]">or enter manually</span>
            <div className="bg-border h-px flex-1" />
          </div>

          {/* Manual entry */}
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs">Title</label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Hollow Knight"
              className="border-border bg-background text-foreground placeholder:text-[var(--text-disabled)]"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-muted-foreground text-xs">Steam App ID (optional)</label>
            <Input
              value={newSteamAppid}
              onChange={(e) => setNewSteamAppid(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 367520"
              className="border-border bg-background text-foreground font-mono placeholder:text-[var(--text-disabled)]"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]"
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
          >
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
