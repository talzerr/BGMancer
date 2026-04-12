"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OnboardingPhase } from "@/types";

interface PhaseStat {
  phase: string;
  count: number;
  publishedCount: number;
  needsReviewCount: number;
}

const PHASE_LABELS: Record<string, string> = {
  [OnboardingPhase.Draft]: "Draft",
  [OnboardingPhase.TracksLoaded]: "Tracks Loaded",
  [OnboardingPhase.Resolved]: "Resolved",
  [OnboardingPhase.Tagged]: "Ready",
  [OnboardingPhase.Failed]: "Failed",
};

const PHASE_COLORS: Record<string, string> = {
  [OnboardingPhase.Draft]: "border-[var(--border-emphasis)] text-muted-foreground",
  [OnboardingPhase.TracksLoaded]: "border-blue-600/50 text-blue-400",
  [OnboardingPhase.Resolved]: "border-primary/50 text-primary",
  [OnboardingPhase.Tagged]: "border-emerald-600/50 text-emerald-400",
  [OnboardingPhase.Failed]: "border-rose-600/50 text-rose-400",
};

export function BackstageDashboard() {
  const [stats, setStats] = useState<PhaseStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/backstage/dashboard");
        if (res.ok) setStats(await res.json());
      } catch {
        /* non-critical */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalGames = stats.reduce((sum, s) => sum + s.count, 0);
  const totalPublished = stats.reduce((sum, s) => sum + s.publishedCount, 0);
  const totalNeedsReview = stats.reduce((sum, s) => sum + s.needsReviewCount, 0);
  const failedCount = stats.find((s) => s.phase === OnboardingPhase.Failed)?.count ?? 0;

  if (loading) {
    return <p className="py-20 text-center text-xs text-[var(--text-disabled)]">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Overview row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Games" value={totalGames} href="/backstage/games" />
        <StatCard
          label="Published"
          value={totalPublished}
          href="/backstage/games?published=1"
          accent="text-emerald-400"
        />
        <StatCard
          label="Needs Review"
          value={totalNeedsReview}
          href="/backstage/games?needsReview=1"
          accent={totalNeedsReview > 0 ? "text-amber-400" : undefined}
        />
        <StatCard
          label="Failed"
          value={failedCount}
          href="/backstage/games?phase=failed"
          accent={failedCount > 0 ? "text-rose-400" : undefined}
        />
      </div>

      {/* Phase breakdown */}
      <div>
        <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
          By Phase
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {Object.values(OnboardingPhase).map((phase) => {
            const stat = stats.find((s) => s.phase === phase);
            const count = stat?.count ?? 0;
            const color = PHASE_COLORS[phase] ?? "border-border text-muted-foreground";
            return (
              <Link
                key={phase}
                href={`/backstage/games?phase=${phase}`}
                className={`bg-secondary/50 hover:bg-secondary/50 rounded-lg border px-4 py-3 transition-colors ${color}`}
              >
                <p className="text-2xl font-medium tabular-nums">{count}</p>
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  {PHASE_LABELS[phase] ?? phase}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className="border-border bg-secondary/50 hover:bg-secondary/50 rounded-lg border px-4 py-3 transition-colors"
    >
      <p className={`text-2xl font-medium tabular-nums ${accent ?? "text-foreground"}`}>{value}</p>
      <p className="text-[11px] text-[var(--text-tertiary)]">{label}</p>
    </Link>
  );
}
