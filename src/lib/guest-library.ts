import type { CurationMode, Game } from "@/types";

export interface GuestLibraryEntry {
  gameId: string;
  curation: CurationMode;
}

const GUEST_LIBRARY_KEY = "bgm_guest_library";
const GUEST_LIBRARY_HYDRATED_KEY = "bgm_guest_library_hydrated";

function isValidEntry(e: unknown): e is GuestLibraryEntry {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as GuestLibraryEntry).gameId === "string" &&
    typeof (e as GuestLibraryEntry).curation === "string"
  );
}

export function readGuestLibrary(): GuestLibraryEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

export function writeGuestLibrary(entries: GuestLibraryEntry[]): void {
  localStorage.setItem(GUEST_LIBRARY_KEY, JSON.stringify(entries));
}

/**
 * Read the hydrated guest library (full Game objects) from localStorage.
 * Used to render the launchpad synchronously on first paint without an
 * async catalog fetch. Returns [] if missing or malformed.
 */
function isValidGame(e: unknown): e is Game {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as Game).id === "string" &&
    typeof (e as Game).title === "string"
  );
}

export function readGuestLibraryHydrated(): Game[] {
  try {
    const raw = localStorage.getItem(GUEST_LIBRARY_HYDRATED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidGame);
  } catch {
    return [];
  }
}

export function writeGuestLibraryHydrated(games: Game[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GUEST_LIBRARY_HYDRATED_KEY, JSON.stringify(games));
}

export function clearGuestLibrary(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GUEST_LIBRARY_KEY);
  localStorage.removeItem(GUEST_LIBRARY_HYDRATED_KEY);
}
