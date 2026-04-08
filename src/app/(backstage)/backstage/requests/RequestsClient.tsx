"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { GameRequest } from "@/lib/db/repo";

export function RequestsClient() {
  const [requests, setRequests] = useState<GameRequest[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAck, setPendingAck] = useState<number | null>(null);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backstage/requests${showAll ? "?all=1" : ""}`);
      if (!res.ok) {
        setError("Failed to load requests.");
        return;
      }
      const data = (await res.json()) as { requests: GameRequest[] };
      setRequests(data.requests);
    } catch {
      setError("Couldn't reach server.");
    } finally {
      setIsLoading(false);
    }
  }, [showAll]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  async function handleAcknowledge(igdbId: number) {
    setPendingAck(igdbId);
    try {
      const res = await fetch("/api/backstage/requests/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ igdbId }),
      });
      if (!res.ok) {
        setError("Failed to acknowledge request.");
        return;
      }
      await fetchRequests();
    } catch {
      setError("Couldn't reach server.");
    } finally {
      setPendingAck(null);
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-foreground text-base font-medium">Game requests</h1>
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          <Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(v === true)} />
          Show all
        </label>
      </div>

      {error && <p className="text-destructive text-xs">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-[var(--text-disabled)]">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-xs text-[var(--text-disabled)]">No requests.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-12 px-2 text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Cover
              </TableHead>
              <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Name
              </TableHead>
              <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Count
              </TableHead>
              <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                First requested
              </TableHead>
              <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Last requested
              </TableHead>
              <TableHead className="text-[11px] tracking-wider text-[var(--text-tertiary)] uppercase">
                Status
              </TableHead>
              <TableHead className="w-32 px-2" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.igdbId} className="border-border">
                <TableCell className="px-2 py-2">
                  <div className="bg-accent flex h-8 w-8 items-center justify-center overflow-hidden rounded">
                    {r.coverUrl ? (
                      <Image
                        src={r.coverUrl}
                        alt=""
                        width={32}
                        height={32}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">{r.name}</TableCell>
                <TableCell className="text-muted-foreground">{r.requestCount}</TableCell>
                <TableCell className="text-[var(--text-tertiary)]">
                  {r.createdAt.slice(0, 10)}
                </TableCell>
                <TableCell className="text-[var(--text-tertiary)]">
                  {r.updatedAt.slice(0, 10)}
                </TableCell>
                <TableCell className="text-[var(--text-tertiary)]">
                  {r.acknowledged ? "Acknowledged" : "Pending"}
                </TableCell>
                <TableCell className="px-2 text-right">
                  {!r.acknowledged && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAcknowledge(r.igdbId)}
                      disabled={pendingAck === r.igdbId}
                    >
                      {pendingAck === r.igdbId ? "..." : "Acknowledge"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
