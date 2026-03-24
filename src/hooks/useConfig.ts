"use client";

import { useEffect, useState } from "react";
import { DEFAULT_TRACK_COUNT } from "@/lib/constants";

const KEYS = {
  targetTrackCount: "bgm_target_track_count",
  antiSpoilerEnabled: "bgm_anti_spoiler_enabled",
  allowLongTracks: "bgm_allow_long_tracks",
  allowShortTracks: "bgm_allow_short_tracks",
  rawVibes: "bgm_raw_vibes",
} as const;

function lsGet<T>(key: string, fallback: T, parse: (v: string) => T): T {
  if (typeof window === "undefined") return fallback;
  const raw = localStorage.getItem(key);
  return raw !== null ? parse(raw) : fallback;
}

function lsSet(key: string, value: string): void {
  if (typeof window !== "undefined") localStorage.setItem(key, value);
}

export function useConfig() {
  const [targetTrackCount, setTargetTrackCount] = useState(DEFAULT_TRACK_COUNT);
  const [antiSpoilerEnabled, setAntiSpoilerEnabled] = useState(false);
  const [allowLongTracks, setAllowLongTracks] = useState(false);
  const [allowShortTracks, setAllowShortTracks] = useState(false);
  const [rawVibes, setRawVibes] = useState(false);

  useEffect(() => {
    Promise.resolve().then(() => {
      setTargetTrackCount(lsGet(KEYS.targetTrackCount, DEFAULT_TRACK_COUNT, Number));
      setAntiSpoilerEnabled(lsGet(KEYS.antiSpoilerEnabled, false, (v) => v === "1"));
      setAllowLongTracks(lsGet(KEYS.allowLongTracks, false, (v) => v === "1"));
      setAllowShortTracks(lsGet(KEYS.allowShortTracks, false, (v) => v === "1"));
      setRawVibes(lsGet(KEYS.rawVibes, false, (v) => v === "1"));
    });
  }, []);

  function saveTrackCount(n: number) {
    setTargetTrackCount(n);
    lsSet(KEYS.targetTrackCount, String(n));
  }

  function saveAntiSpoiler(enabled: boolean) {
    setAntiSpoilerEnabled(enabled);
    lsSet(KEYS.antiSpoilerEnabled, enabled ? "1" : "0");
  }

  function saveAllowLongTracks(enabled: boolean) {
    setAllowLongTracks(enabled);
    lsSet(KEYS.allowLongTracks, enabled ? "1" : "0");
  }

  function saveAllowShortTracks(enabled: boolean) {
    setAllowShortTracks(enabled);
    lsSet(KEYS.allowShortTracks, enabled ? "1" : "0");
  }

  function saveRawVibes(enabled: boolean) {
    setRawVibes(enabled);
    lsSet(KEYS.rawVibes, enabled ? "1" : "0");
  }

  return {
    targetTrackCount,
    setTargetTrackCount,
    saveTrackCount,
    antiSpoilerEnabled,
    saveAntiSpoiler,
    allowLongTracks,
    saveAllowLongTracks,
    allowShortTracks,
    saveAllowShortTracks,
    rawVibes,
    saveRawVibes,
  };
}
