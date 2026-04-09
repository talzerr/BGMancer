"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Steady timer-driven cycle through the shuffled list. After one full pass
  // we lock onto "Assembling playlist…" until the pipeline finishes.
  useEffect(() => {
    if (showAssembling || shuffled.length === 0) return;

    const atEnd = displayIndex >= shuffled.length - 1;

    const fadeTimer = setTimeout(() => {
      setNameOpacity(0);
      swapTimerRef.current = setTimeout(() => {
        if (atEnd) {
          setShowAssembling(true);
        } else {
          setDisplayIndex((i) => i + 1);
        }
        setNameOpacity(1);
      }, FADE_MS);
    }, HOLD_MS);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(swapTimerRef.current);
    };
  }, [displayIndex, shuffled.length, showAssembling]);

  const currentTitle = shuffled[displayIndex]?.title ?? "";

  return (
    <p className="text-center text-[13px] leading-tight">
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
