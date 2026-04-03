/**
 * Tracklist source metadata — provenance/audit for where a game's soundtrack is cataloged.
 *
 * This module provides parsing, formatting, and URL generation for tracklist source strings
 * (e.g. "vgmdb:79", "discogs-release:123"). It does NOT handle fetching — that's a separate concern.
 */

import { TracklistSource } from "@/types";

// ─── Static source metadata ─────────────────────────────────────────────────

interface SourceMeta {
  key: TracklistSource;
  label: string;
  externalUrl: (id: string) => string;
}

const SOURCE_META: SourceMeta[] = [
  {
    key: TracklistSource.DiscogsRelease,
    label: "Discogs Release",
    externalUrl: (id) => `https://www.discogs.com/release/${id}`,
  },
  {
    key: TracklistSource.DiscogsMaster,
    label: "Discogs Master",
    externalUrl: (id) => `https://www.discogs.com/master/${id}`,
  },
  {
    key: TracklistSource.Vgmdb,
    label: "VGMdb",
    externalUrl: (id) => `https://vgmdb.net/album/${id}`,
  },
  {
    key: TracklistSource.Manual,
    label: "Manual",
    externalUrl: () => "",
  },
];

const metaByKey = new Map(SOURCE_META.map((m) => [m.key as string, m]));

// ─── Parsing & metadata ────────────────────────────────────────────────────

const SOURCE_PATTERN = /^([\w-]+):(\d+)$/;

export type ParsedSource = { key: string; id: string };

/** Parse a tracklist_source string. Supports "type:id" (e.g. "discogs-release:123") and bare keys (e.g. "manual"). */
export function parseSource(raw: string | null): ParsedSource | null {
  if (!raw) return null;
  // Bare key with no ID (e.g. "manual")
  if (metaByKey.has(raw)) return { key: raw, id: "" };
  const match = raw.match(SOURCE_PATTERN);
  if (!match) return null;
  return { key: match[1], id: match[2] };
}

/** Build a "type:id" string from key + id. */
export function formatSource(key: string, id: string): string {
  return `${key}:${id}`;
}

/** Get the external URL for a tracklist source string, or undefined. */
export function sourceUrl(raw: string | null): string | undefined {
  const parsed = parseSource(raw);
  if (!parsed) return undefined;
  return metaByKey.get(parsed.key)?.externalUrl(parsed.id);
}

/** Return all source keys with their labels (for UI dropdowns). */
export function getRegisteredSources(): Array<{ key: string; label: string }> {
  return SOURCE_META.map(({ key, label }) => ({ key, label }));
}
