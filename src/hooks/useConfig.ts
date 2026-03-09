"use client";

import { useEffect, useState } from "react";

export function useConfig() {
  const [targetTrackCount, setTargetTrackCount] = useState(50);
  const [antiSpoilerEnabled, setAntiSpoilerEnabled] = useState(false);
  const [allowLongTracks, setAllowLongTracks] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.target_track_count) setTargetTrackCount(cfg.target_track_count);
        if (cfg?.anti_spoiler_enabled !== undefined)
          setAntiSpoilerEnabled(cfg.anti_spoiler_enabled);
        if (cfg?.allow_long_tracks !== undefined) setAllowLongTracks(cfg.allow_long_tracks);
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

  async function saveAntiSpoiler(enabled: boolean) {
    setAntiSpoilerEnabled(enabled);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anti_spoiler_enabled: enabled }),
    }).catch(() => {});
  }

  async function saveAllowLongTracks(enabled: boolean) {
    setAllowLongTracks(enabled);
    await fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow_long_tracks: enabled }),
    }).catch(() => {});
  }

  return {
    targetTrackCount,
    setTargetTrackCount,
    saveTrackCount,
    antiSpoilerEnabled,
    saveAntiSpoiler,
    allowLongTracks,
    saveAllowLongTracks,
  };
}
