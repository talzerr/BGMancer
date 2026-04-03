import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GAME_TITLE_MAX_LENGTH } from "@/lib/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Builds a friendly URL slug: "elden-ring--019d1a36-..." */
export function gameSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}--${id}`;
}

/** Extracts the game ID from a friendly slug (the part after "--"). */
export function idFromGameSlug(slug: string): string {
  const idx = slug.lastIndexOf("--");
  return idx === -1 ? slug : slug.slice(idx + 2);
}

/**
 * Sanitizes a game title for storage and display.
 * 1. NFKC normalize — collapses full-width chars (Ｐｏｋéｍｏｎ → Pokémon)
 * 2. Strip Unicode symbols (\p{S}) and control chars (\p{C})
 * 3. Whitelist: keep letters, numbers, whitespace, and catalog-safe punctuation
 * 4. Collapse whitespace, trim, enforce max length
 */
export function sanitizeGameTitle(raw: string): string {
  return (
    raw
      // Strip legal marks before NFKC (™→"TM", ℠→"SM" under NFKC)
      .replace(/[\u2122\u00AE\u00A9\u2120]/g, "")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}\p{M}\s:.\-'&!?,()[\]/+#~・]/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, GAME_TITLE_MAX_LENGTH)
  );
}
