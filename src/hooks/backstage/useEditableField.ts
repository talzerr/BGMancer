"use client";

import { useState } from "react";

export function useEditableField(value: string, onSave: (value: string | null) => void) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function startEditing() {
    setDraft(value);
    setEditing(true);
  }

  function commit(opts?: { trimmed?: boolean }) {
    setEditing(false);
    const result = opts?.trimmed ? draft.trim() : draft;
    if (result !== value) onSave(result || null);
    else setDraft(value);
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  return { editing, draft, setDraft, startEditing, commit, cancel };
}
