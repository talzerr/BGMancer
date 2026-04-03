"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function EditableTitle({
  value,
  disabled,
  onSave,
}: {
  value: string;
  disabled?: boolean;
  onSave: (value: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  }

  if (editing && !disabled) {
    return (
      <Input
        autoFocus
        maxLength={100}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-8 border-zinc-700 bg-zinc-800 font-sans text-xl font-semibold text-zinc-100"
      />
    );
  }

  return (
    <h1
      onClick={() => {
        if (!disabled) {
          setDraft(value);
          setEditing(true);
        }
      }}
      className={`font-sans text-xl font-semibold text-zinc-100 ${
        disabled ? "" : "-ml-1 cursor-pointer rounded px-1 hover:bg-zinc-800/60"
      }`}
    >
      {value}
    </h1>
  );
}
