import type { CurationMode } from "@/types";

export interface GuestLibraryEntry {
  gameId: string;
  curation: CurationMode;
}

const GUEST_LIBRARY_KEY = "bgm_guest_library";

export function readGuestLibrary(): GuestLibraryEntry[] {
  try {
    const raw = localStorage.getItem(GUEST_LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GuestLibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeGuestLibrary(entries: GuestLibraryEntry[]): void {
  localStorage.setItem(GUEST_LIBRARY_KEY, JSON.stringify(entries));
}
