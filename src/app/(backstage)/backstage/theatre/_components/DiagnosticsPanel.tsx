"use client";

import { useMemo } from "react";
import { SelectionPass } from "@/types";
import type { TrackDecision } from "@/types";
import { Section } from "./Section";

interface Diagnostic {
  severity: "warning" | "info";
  message: string;
}

export function DiagnosticsPanel({
  decisions,
  gameNames,
}: {
  decisions: TrackDecision[];
  gameNames: Record<string, string>;
}) {
  const diagnostics = useMemo(() => {
    const issues: Diagnostic[] = [];

    // Same-game runs >= 3
    let runLength = 1;
    for (let i = 1; i < decisions.length; i++) {
      if (decisions[i].gameId === decisions[i - 1].gameId) {
        runLength++;
      } else {
        if (runLength >= 3) {
          const gid = decisions[i - 1].gameId;
          const name = gameNames[gid] ?? gid.slice(0, 8);
          issues.push({
            severity: "warning",
            message: `${runLength}-track run from "${name}" at positions ${i - runLength}-${i - 1}`,
          });
        }
        runLength = 1;
      }
    }
    if (runLength >= 3) {
      const gid = decisions[decisions.length - 1].gameId;
      const name = gameNames[gid] ?? gid.slice(0, 8);
      issues.push({
        severity: "warning",
        message: `${runLength}-track run from "${name}" at end of playlist`,
      });
    }

    // Low-score selections
    const lowScoreCount = decisions.filter((d) => d.adjustedScore < 0.1).length;
    if (lowScoreCount > 0) {
      issues.push({
        severity: "warning",
        message: `${lowScoreCount} track${lowScoreCount > 1 ? "s" : ""} with adjusted score < 0.1`,
      });
    }

    // Fallback / last resort
    const fallbackCount = decisions.filter(
      (d) =>
        d.selectionPass === SelectionPass.Fallback || d.selectionPass === SelectionPass.LastResort,
    ).length;
    if (fallbackCount > 0) {
      issues.push({
        severity: "info",
        message: `${fallbackCount} track${fallbackCount > 1 ? "s" : ""} placed via fallback/last-resort`,
      });
    }

    // Budget exhaustion
    const exhausted = new Set<string>();
    for (const d of decisions) {
      if (d.gameBudgetUsed >= d.gameBudget && d.gameBudget > 0) exhausted.add(d.gameId);
    }
    if (exhausted.size > 0) {
      const names = [...exhausted].map((id) => gameNames[id] ?? id.slice(0, 8)).join(", ");
      issues.push({
        severity: "info",
        message: `Budget fully consumed for: ${names}`,
      });
    }

    return issues;
  }, [decisions, gameNames]);

  return (
    <Section title="Diagnostics">
      {diagnostics.length === 0 ? (
        <p className="text-xs text-emerald-500">No issues detected.</p>
      ) : (
        <div className="space-y-1">
          {diagnostics.map((d, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
                d.severity === "warning"
                  ? "bg-amber-900/10 text-amber-400"
                  : "bg-secondary/30 text-muted-foreground"
              }`}
            >
              <span className="shrink-0">{d.severity === "warning" ? "!" : "i"}</span>
              <span>{d.message}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
