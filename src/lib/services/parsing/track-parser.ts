/**
 * Parse raw text into a normalized track list.
 *
 * Handles common tracklist formats: numbered/unnumbered lines,
 * with or without durations (M:SS, MM:SS, H:MM:SS).
 */

export interface ParsedTrack {
  name: string;
  position: number;
}

const DURATION_PATTERN = /(\d{1,2}:\d{2}(?::\d{2})?)/;
const LEADING_NUMBER_PATTERN = /^\d+[\s).\-–—]+\s*/;

function parseLine(line: string, position: number): ParsedTrack {
  // Strip leading track numbers like "01.", "1.", "01 -", "1 -", "01)", "1)"
  const stripped = line.replace(LEADING_NUMBER_PATTERN, "");
  // Remove duration strings (M:SS, MM:SS, H:MM:SS) so they don't end up in the name
  let name = stripped.replace(DURATION_PATTERN, "").trim();
  // Clean up trailing/leading separators left after removing duration
  name = name.replace(/[\s\-–—]+$/, "").replace(/^[\s\-–—]+/, "");

  return { name: name || stripped, position };
}

/** Parse a pasted tracklist into an array of tracks. */
export function parseTracklist(text: string): ParsedTrack[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => parseLine(line, i + 1));
}
