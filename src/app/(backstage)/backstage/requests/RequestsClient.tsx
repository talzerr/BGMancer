"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
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
        <h1 className="text-base font-medium text-[var(--text-primary)]">Game requests</h1>
        <label className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all
        </label>
      </div>

      {error && <p className="text-xs text-[var(--destructive)]">{error}</p>}

      {isLoading ? (
        <p className="text-xs text-[var(--text-disabled)]">Loading...</p>
      ) : requests.length === 0 ? (
        <p className="text-xs text-[var(--text-disabled)]">No requests.</p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-border border-b text-left text-[var(--text-tertiary)]">
              <th className="px-2 py-2 font-medium">Cover</th>
              <th className="px-2 py-2 font-medium">Name</th>
              <th className="px-2 py-2 font-medium">Count</th>
              <th className="px-2 py-2 font-medium">First requested</th>
              <th className="px-2 py-2 font-medium">Last requested</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.igdbId} className="border-border border-b">
                <td className="px-2 py-2">
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded bg-[var(--surface-hover)]">
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
                </td>
                <td className="px-2 py-2 text-[var(--text-primary)]">{r.name}</td>
                <td className="px-2 py-2 text-[var(--text-secondary)]">{r.requestCount}</td>
                <td className="px-2 py-2 text-[var(--text-tertiary)]">
                  {r.createdAt.slice(0, 10)}
                </td>
                <td className="px-2 py-2 text-[var(--text-tertiary)]">
                  {r.updatedAt.slice(0, 10)}
                </td>
                <td className="px-2 py-2 text-[var(--text-tertiary)]">
                  {r.acknowledged ? "Acknowledged" : "Pending"}
                </td>
                <td className="px-2 py-2 text-right">
                  {!r.acknowledged && (
                    <button
                      type="button"
                      onClick={() => handleAcknowledge(r.igdbId)}
                      disabled={pendingAck === r.igdbId}
                      className="rounded border border-[var(--border-emphasis)] px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors duration-100 hover:bg-[var(--surface-hover)] disabled:opacity-50"
                    >
                      {pendingAck === r.igdbId ? "..." : "Acknowledge"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
