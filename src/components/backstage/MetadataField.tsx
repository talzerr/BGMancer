"use client";

import { Input } from "@/components/ui/input";
import { useEditableField } from "@/hooks/backstage/useEditableField";

export function MetadataField({
  label,
  value,
  placeholder,
  disabled,
  href,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  href?: string;
  onSave: (value: string | null) => void;
}) {
  const { editing, draft, setDraft, startEditing, commit, cancel } = useEditableField(
    value,
    onSave,
  );

  return (
    <>
      <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
        {label}
        {href && value && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 transition-colors hover:text-zinc-300"
            onClick={(e) => e.stopPropagation()}
          >
            ↗
          </a>
        )}
      </span>
      {editing && !disabled ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancel();
          }}
          placeholder={placeholder}
          className="h-7 border-zinc-700 bg-zinc-800 font-mono text-xs text-zinc-100 placeholder:text-zinc-600"
        />
      ) : (
        <button
          onClick={() => !disabled && startEditing()}
          className={`truncate rounded px-1.5 py-1 text-left font-mono text-xs transition-colors ${
            disabled ? "cursor-default text-zinc-600" : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          {value || <span className="text-zinc-600">{disabled ? "—" : placeholder}</span>}
        </button>
      )}
    </>
  );
}
