"use client";

import { useEffect, useState } from "react";
import { COOLDOWN_QUIPS } from "@/lib/constants";

export function useCooldownTimer(cooldownUntil: number) {
  const [secsLeft, setSecsLeft] = useState(0);
  const [quip, setQuip] = useState("");

  useEffect(() => {
    const update = () => setSecsLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    // A zero-delay timeout fires in the next task (not synchronously in the effect body),
    // giving an immediate first tick without triggering the cascading-renders lint rule.
    // We also pick a new quip here so both updates happen in the same scheduled task.
    const timeout = setTimeout(() => {
      update();
      if (cooldownUntil > Date.now()) {
        setQuip(COOLDOWN_QUIPS[Math.floor(Math.random() * COOLDOWN_QUIPS.length)]);
      }
    }, 0);
    const interval = setInterval(update, 250);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [cooldownUntil]);

  return { secsLeft, quip };
}
