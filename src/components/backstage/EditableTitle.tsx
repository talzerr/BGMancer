"use client";

import { Input } from "@/components/ui/input";
import { useEditableField } from "@/hooks/backstage/useEditableField";
import { GAME_TITLE_MAX_LENGTH } from "@/lib/constants";

export function EditableTitle({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (value: string | null) => void;
}) {
  const { editing, draft, setDraft, startEditing, commit, cancel } = useEditableField(
    value,
    onSave,
  );

  if (editing && !disabled) {
    return (
      <Input
        autoFocus
        maxLength={GAME_TITLE_MAX_LENGTH}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit({ trimmed: true })}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit({ trimmed: true });
          if (e.key === "Escape") cancel();
        }}
        className="h-8 border-zinc-700 bg-zinc-800 font-sans text-xl font-semibold text-zinc-100"
      />
    );
  }

  return (
    <h1
      onClick={() => !disabled && startEditing()}
      className={`font-sans text-xl font-semibold text-zinc-100 ${
        disabled ? "" : "-ml-1 cursor-pointer rounded px-1 hover:bg-zinc-800/60"
      }`}
    >
      {value}
    </h1>
  );
}
