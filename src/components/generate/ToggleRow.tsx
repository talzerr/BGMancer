"use client";

interface ToggleRowProps {
  label: string;
  description: string;
  on: boolean;
  onToggle: () => void;
  /** `bright` (sidebar settings): 13px label, amber "on". `dim` (launchpad
   *  Advanced reveal): 12px label, muted "on". Defaults to `bright`. */
  variant?: "bright" | "dim";
}

export function ToggleRow({
  label,
  description,
  on,
  onToggle,
  variant = "bright",
}: ToggleRowProps) {
  const labelSize = variant === "dim" ? "text-[12px]" : "text-[13px]";
  const labelColor = on ? "text-[var(--text-secondary)]" : "text-[var(--text-disabled)]";
  const onOffActive = variant === "dim" ? "text-[var(--text-secondary)]" : "text-primary";
  const onOffColor = on ? onOffActive : "text-[var(--text-disabled)]";

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full cursor-pointer flex-col gap-0.5 text-left"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className={`${labelSize} transition-colors ${labelColor}`}>{label}</span>
        <span className={`text-[11px] transition-colors ${onOffColor}`}>{on ? "on" : "off"}</span>
      </div>
      <span className="text-[11px] text-[var(--text-quaternary)]">{description}</span>
    </button>
  );
}
