/**
 * Tracklist source metadata — provenance/audit for where a game's soundtrack is cataloged.
 *
 * This module provides parsing, formatting, and URL generation for tracklist source strings
 * (e.g. "vgmdb:79", "discogs-release:123"). It does NOT handle fetching — that's a separate concern.
 */

// ─── Static source metadata ─────────────────────────────────────────────────

interface SourceMeta {
  key: string;
  label: string;
  externalUrl: (id: string) => string;
}

const SOURCE_META: SourceMeta[] = [
  {
    key: "discogs-release",
    label: "Discogs Release",
    externalUrl: (id) => `https://www.discogs.com/release/${id}`,
  },
  {
    key: "discogs-master",
    label: "Discogs Master",
    externalUrl: (id) => `https://www.discogs.com/master/${id}`,
  },
  {
    key: "vgmdb",
    label: "VGMdb",
    externalUrl: (id) => `https://vgmdb.net/album/${id}`,
  },
];

const metaByKey = new Map(SOURCE_META.map((m) => [m.key, m]));

// ─── Parsing & metadata ────────────────────────────────────────────────────

const SOURCE_PATTERN = /^([\w-]+):(\d+)$/;

export type ParsedSource = { key: string; id: string };

/** Parse a "type:id" tracklist_source string. Returns null for empty/invalid. */
export function parseSource(raw: string | null): ParsedSource | null {
  if (!raw) return null;
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
