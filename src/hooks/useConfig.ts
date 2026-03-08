"use client";

import { useEffect, useState } from "react";
import type { VibePreference } from "@/types";

export function useConfig() {
  const [targetTrackCount, setTargetTrackCount] = useState(50);
  const [vibe, setVibe] = useState<VibePreference>("official_soundtrack");

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.target_track_count) setTargetTrackCount(cfg.target_track_count);
        if (cfg?.vibe) setVibe(cfg.vibe as VibePreference);
      })
      .catch(() => {});
  }, []);

  async function saveTrackCount(n: number) {
    setTargetTrackCount(n);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_track_count: n }),
    }).catch(() => {});
  }

  async function saveVibe(v: VibePreference) {
    setVibe(v);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vibe: v }),
    }).catch(() => {});
  }

  return { targetTrackCount, setTargetTrackCount, saveTrackCount, vibe, saveVibe };
}
