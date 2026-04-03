"use client";

import { Badge } from "@/components/ui/badge";
import type { ReviewFlag } from "@/lib/db/repos/review-flags";
import type { GameDetailActions } from "../_hooks/useGameDetailActions";

export function ReviewFlagsPanel({
  reviewFlags,
  actions,
  flagsRef,
}: {
  reviewFlags: ReviewFlag[];
  actions: GameDetailActions;
  flagsRef: React.RefObject<HTMLDetailsElement | null>;
}) {
  if (reviewFlags.length === 0) return null;

  return (
    <details
      ref={flagsRef}
      className="group rounded-lg border border-amber-800/30 bg-amber-900/10 px-4 py-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <p className="text-[11px] font-semibold tracking-wider text-amber-500 uppercase">
          <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
          Review flags ({reviewFlags.length})
        </p>
        <button
          onClick={async (e) => {
            e.preventDefault();
            await actions.clearAllFlags();
          }}
          className="text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Clear all
        </button>
      </summary>
      <div className="mt-2 space-y-1">
        {reviewFlags.map((flag) => (
          <div key={flag.id} className="flex items-center gap-2 font-mono text-[11px]">
            <Badge variant="outline" className="border-amber-700/50 bg-amber-500/10 text-amber-400">
              {flag.reason}
            </Badge>
            {flag.detail && <span className="text-zinc-500">{flag.detail}</span>}
            <span className="ml-auto text-zinc-600">{flag.createdAt.slice(0, 10)}</span>
            <button
              onClick={() => actions.clearSingleFlag(flag.id)}
              className="text-zinc-600 transition-colors hover:text-zinc-300"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
