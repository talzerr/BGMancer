"use client";

import { useState } from "react";
import { MAX_TRACK_COUNT } from "@/lib/constants";

const PRESETS = [25, 50, 100] as const;

interface GenerateControlsProps {
  targetTrackCount: number;
  onTargetSave: (n: number) => void;
  allowLongTracks: boolean;
  onToggleLongTracks: (enabled: boolean) => void;
  allowShortTracks: boolean;
  onToggleShortTracks: (enabled: boolean) => void;
  rawVibes: boolean;
  onToggleRawVibes: (enabled: boolean) => void;
}

export function GenerateControls({
  targetTrackCount,
  onTargetSave,
  allowLongTracks,
  onToggleLongTracks,
  allowShortTracks,
  onToggleShortTracks,
  rawVibes,
  onToggleRawVibes,
}: GenerateControlsProps) {
  const isPresetValue = (PRESETS as readonly number[]).includes(targetTrackCount);
  // Custom is active when the user has explicitly opened it OR when the
  // current value isn't one of the presets.
  const [customClicked, setCustomClicked] = useState(false);
  const customActive = customClicked || !isPresetValue;

  function handlePresetClick(n: number) {
    setCustomClicked(false);
    onTargetSave(n);
  }

  function handleCustomClick() {
    setCustomClicked(true);
  }

  const sizeOptionClass = (active: boolean) =>
    `cursor-pointer transition-colors ${
      active
        ? "text-primary font-medium underline decoration-primary/40 underline-offset-4"
        : "text-[var(--text-disabled)] hover:text-[var(--text-tertiary)]"
    }`;

  return (
    <div className="flex flex-col gap-2 px-1">
      <span className="text-muted-foreground text-[11px] font-medium tracking-widest uppercase">
        Settings
      </span>

      {/* Playlist size row */}
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-[var(--text-secondary)]">Playlist size</span>
        <div className="flex items-center gap-3 text-[12px]">
          {PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handlePresetClick(n)}
              className={`tabular-nums ${sizeOptionClass(!customActive && targetTrackCount === n)}`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCustomClick}
            className={sizeOptionClass(customActive)}
          >
            Custom
          </button>
          {customActive && <CustomSizeInput value={targetTrackCount} onCommit={onTargetSave} />}
        </div>
      </div>

      <div className="border-t border-white/[0.04]" />

      {/* Option toggle rows */}
      <div className="flex flex-col gap-2">
        <ToggleRow
          label="Long tracks"
          description="Allow tracks over 9 min"
          on={allowLongTracks}
          onToggle={() => onToggleLongTracks(!allowLongTracks)}
        />
        <ToggleRow
          label="Short tracks"
          description="Allow tracks under 90s"
          on={allowShortTracks}
          onToggle={() => onToggleShortTracks(!allowShortTracks)}
        />
        <ToggleRow
          label="Raw vibes"
          description="Ignore popularity, score on tags only"
          on={rawVibes}
          onToggle={() => onToggleRawVibes(!rawVibes)}
        />
      </div>
    </div>
  );
}

// Local to this file: the launchpad has its own ToggleRow with a dimmer
// "on/off" treatment. Sharing them would force one to compromise.
function ToggleRow({
  label,
  description,
  on,
  onToggle,
}: {
  label: string;
  description: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full cursor-pointer flex-col gap-0.5 text-left"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span
          className={`text-[13px] ${
            on ? "text-[var(--text-secondary)]" : "text-[var(--text-disabled)]"
          }`}
        >
          {label}
        </span>
        <span className={`text-[11px] ${on ? "text-primary" : "text-[var(--text-disabled)]"}`}>
          {on ? "on" : "off"}
        </span>
      </div>
      <span className="text-[11px] text-white/[0.15]">{description}</span>
    </button>
  );
}

function CustomSizeInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);
  if (syncedValue !== value) {
    setSyncedValue(value);
    setDraft(String(value));
  }

  function commit() {
    const v = parseInt(draft, 10);
    if (!isNaN(v) && v >= 1 && v <= MAX_TRACK_COUNT && v !== value) {
      onCommit(v);
    } else {
      setDraft(String(value));
    }
  }

  return (
    <input
      type="number"
      min={1}
      max={MAX_TRACK_COUNT}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
      autoFocus
      aria-label="Custom playlist size"
      className="text-foreground w-10 [appearance:textfield] rounded-[4px] border border-white/[0.12] bg-transparent px-1 py-0.5 text-center text-[12px] tabular-nums focus:border-white/20 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
