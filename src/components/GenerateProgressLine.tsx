"use client";

import { useEffect, useMemo, useState } from "react";

interface GenerateProgressLineProps {
  games: { id: string; title: string }[];
}

const HOLD_MS = 300;
const FADE_MS = 200;

function shuffle<T>(input: T[]): T[] {
  const out = input.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function GenerateProgressLine({ games }: GenerateProgressLineProps) {
  const shuffled = useMemo(() => shuffle(games), [games]);

  const [displayIndex, setDisplayIndex] = useState(0);
  const [showAssembling, setShowAssembling] = useState(false);
  const [nameOpacity, setNameOpacity] = useState(1);

  // Steady timer-driven cycle through the shuffled list. After one full pass
  // we lock onto "Assembling playlist…" until the pipeline finishes.
  useEffect(() => {
    if (showAssembling || shuffled.length === 0) return;

    const atEnd = displayIndex >= shuffled.length - 1;

    const fadeTimer = setTimeout(() => {
      setNameOpacity(0);
      const swapTimer = setTimeout(() => {
        if (atEnd) {
          setShowAssembling(true);
        } else {
          setDisplayIndex((i) => i + 1);
        }
        setNameOpacity(1);
      }, FADE_MS);
      return () => clearTimeout(swapTimer);
    }, HOLD_MS);

    return () => clearTimeout(fadeTimer);
  }, [displayIndex, shuffled.length, showAssembling]);

  const currentTitle = shuffled[displayIndex]?.title ?? "";

  return (
    <p className="mt-3 text-center text-[13px] leading-tight">
      {showAssembling ? (
        <span className="text-[var(--text-tertiary)]">Assembling playlist…</span>
      ) : (
        <>
          <span className="text-[var(--text-tertiary)]">Curating from </span>
          <span
            className="text-foreground transition-opacity ease-[cubic-bezier(0.25,0.1,0.25,1)]"
            style={{ opacity: nameOpacity, transitionDuration: `${FADE_MS}ms` }}
          >
            {currentTitle}
          </span>
        </>
      )}
    </p>
  );
}
