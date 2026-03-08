"use client";

import { useEffect, useState } from "react";
import type { VibePreference } from "@/types";

export function useConfig() {
  const [targetTrackCount, setTargetTrackCount] = useState(50);
  const [vibe, setVibe] = useState<VibePreference>("official_soundtrack");
  const [antiSpoilerEnabled, setAntiSpoilerEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.target_track_count) setTargetTrackCount(cfg.target_track_count);
        if (cfg?.vibe) setVibe(cfg.vibe as VibePreference);
        if (cfg?.anti_spoiler_enabled !== undefined)
          setAntiSpoilerEnabled(cfg.anti_spoiler_enabled);
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

  async function saveAntiSpoiler(enabled: boolean) {
    setAntiSpoilerEnabled(enabled);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anti_spoiler_enabled: enabled }),
    }).catch(() => {});
  }

  return {
    targetTrackCount,
    setTargetTrackCount,
    saveTrackCount,
    vibe,
    saveVibe,
    antiSpoilerEnabled,
    saveAntiSpoiler,
  };
}
