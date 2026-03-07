"use client";

import { useEffect, useState } from "react";

export function useConfig() {
  const [targetTrackCount, setTargetTrackCount] = useState(50);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg?.target_track_count) setTargetTrackCount(cfg.target_track_count);
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

  return { targetTrackCount, setTargetTrackCount, saveTrackCount };
}
