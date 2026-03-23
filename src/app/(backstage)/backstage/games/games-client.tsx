"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/backstage/StatusBadge";
import { TaggingStatus } from "@/types";
import type { BackstageGame } from "@/lib/db/repos/games";
import { gameSlug } from "@/lib/utils";

export function GamesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [titleSearch, setTitleSearch] = useState(() => searchParams.get("title") ?? "");
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get("status") ?? "all");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(
    () => searchParams.get("needsReview") === "1",
  );

  const [games, setGames] = useState<BackstageGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchGames = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams();
    if (titleSearch.trim()) params.set("title", titleSearch.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (needsReviewOnly) params.set("needsReview", "1");

    router.replace(`/backstage/games${params.size ? `?${params}` : ""}`, { scroll: false });

    try {
      const res = await fetch(`/api/backstage/games?${params}`);
      if (!res.ok) throw new Error(`Server error: HTTP ${res.status}`);
      const data = (await res.json()) as BackstageGame[];
      setGames(data);
      setHasSearched(true);
    } catch (err) {
      console.error("[GamesClient] fetchGames failed:", err);
      setFetchError("Failed to load games. Try again.");
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }, [titleSearch, statusFilter, needsReviewOnly, router]);

  // Auto-fetch on mount if URL has params
  useEffect(() => {
    if (searchParams.size > 0) {
      Promise.resolve().then(() => fetchGames());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by title…"
          value={titleSearch}
          onChange={(e) => setTitleSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchGames()}
          className="h-8 w-56 border-zinc-700 bg-zinc-900 text-xs text-zinc-200 placeholder:text-zinc-600 focus-visible:ring-violet-500/50"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="h-8 w-36 border-zinc-700 bg-zinc-900 text-xs text-zinc-400">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="all" className="text-xs text-zinc-400">
              All statuses
            </SelectItem>
            {Object.values(TaggingStatus).map((s) => (
              <SelectItem key={s} value={s} className="text-xs capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-500 select-none">
          <Checkbox
            checked={needsReviewOnly}
            onCheckedChange={(v) => setNeedsReviewOnly(!!v)}
            className="h-3.5 w-3.5 border-zinc-600 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500"
          />
          Needs review
        </label>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-zinc-700 px-4 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          onClick={fetchGames}
          disabled={loading}
        >
          {loading ? "Searching…" : "Search"}
        </Button>
        {hasSearched && (
          <span className="ml-auto font-mono text-xs text-zinc-600">
            {games.length} result{games.length === 1 ? "" : "s"}
            {games.length === 100 && " · limit reached"}
          </span>
        )}
      </div>

      {fetchError && <p className="text-xs text-rose-400">{fetchError}</p>}

      {/* Results */}
      {!hasSearched ? (
        <p className="py-10 text-center text-xs text-zinc-600">
          Search by title or filter by status to find games.
        </p>
      ) : games.length === 0 ? (
        <p className="py-10 text-center text-xs text-zinc-600">
          No games match the current filters.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800 hover:bg-transparent">
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Title
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Status
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Tracks
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Tagged
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Review
                </TableHead>
                <TableHead className="text-[11px] tracking-wider text-zinc-500 uppercase">
                  Source
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {games.map((game) => (
                <TableRow
                  key={game.id}
                  onClick={() => router.push(`/backstage/games/${gameSlug(game.title, game.id)}`)}
                  className="cursor-pointer border-zinc-800/60 hover:bg-zinc-800/30"
                >
                  <TableCell className="py-2.5 text-sm text-zinc-200">{game.title}</TableCell>
                  <TableCell className="py-2.5">
                    <StatusBadge status={game.tagging_status} />
                  </TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-zinc-400">
                    {game.activeCount}/{game.trackCount}
                  </TableCell>
                  <TableCell className="py-2.5 font-mono text-xs text-zinc-400">
                    {game.taggedCount}
                    {game.trackCount > 0 && (
                      <span className="ml-1 text-zinc-600">
                        ({Math.round((game.taggedCount / game.trackCount) * 100)}%)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    {game.reviewFlagCount > 0 ? (
                      <span className="font-mono text-xs text-amber-400">
                        {game.reviewFlagCount}
                      </span>
                    ) : (
                      <span className="text-zinc-700">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5 font-mono text-[11px] text-zinc-500">
                    {game.tracklist_source ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
