import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  return slug.split("--").pop() ?? slug;
}
