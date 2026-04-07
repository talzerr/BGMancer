"use client";

interface SteamFilterToggleProps {
  active: boolean;
  onToggle: () => void;
}

export function SteamFilterToggle({ active, onToggle }: SteamFilterToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-[13px] transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
        active
          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
          : "border-[var(--border-default)] bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
      }`}
    >
      My Steam games
    </button>
  );
}
