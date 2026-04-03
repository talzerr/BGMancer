/**
 * Parse raw text into a normalized track list.
 *
 * Handles common tracklist formats: numbered/unnumbered lines,
 * with or without durations (M:SS, MM:SS, H:MM:SS).
 */

export interface ParsedTrack {
  name: string;
  position: number;
  durationSeconds: number | null;
}

const DURATION_PATTERN = /(\d{1,2}:\d{2}(?::\d{2})?)/;
const LEADING_NUMBER_PATTERN = /^\d+[\s).\-–—]+\s*/;

function parseDuration(raw: string): number | null {
  const parts = raw.split(":").map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function parseLine(line: string, position: number): ParsedTrack {
  // Strip leading track numbers like "01.", "1.", "01 -", "1 -", "01)", "1)"
  const stripped = line.replace(LEADING_NUMBER_PATTERN, "");
  const durMatch = stripped.match(DURATION_PATTERN);
  let durationSeconds: number | null = null;
  let name = stripped;

  if (durMatch) {
    name = stripped.replace(DURATION_PATTERN, "").trim();
    // Clean up trailing/leading separators left after removing duration
    name = name.replace(/[\s\-–—]+$/, "").replace(/^[\s\-–—]+/, "");
    durationSeconds = parseDuration(durMatch[1]);
  }

  return { name: name || stripped, position, durationSeconds };
}

/** Parse a pasted tracklist into an array of tracks. */
export function parseTracklist(text: string): ParsedTrack[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => parseLine(line, i + 1));
}
