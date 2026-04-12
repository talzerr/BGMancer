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
        className="border-border bg-secondary text-foreground h-8 font-sans text-xl font-medium"
      />
    );
  }

  return (
    <h1
      onClick={() => !disabled && startEditing()}
      className={`text-foreground font-sans text-xl font-medium ${
        disabled ? "" : "hover:bg-secondary/60 -ml-1 cursor-pointer rounded px-1"
      }`}
    >
      {value}
    </h1>
  );
}
