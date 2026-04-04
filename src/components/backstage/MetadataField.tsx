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
      <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--text-tertiary)]">
        {label}
        {href && value && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground text-[var(--text-disabled)] transition-colors"
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
          className="border-border bg-background text-foreground h-7 font-mono text-xs placeholder:text-[var(--text-disabled)]"
        />
      ) : (
        <button
          onClick={() => !disabled && startEditing()}
          className={`truncate rounded px-1.5 py-1 text-left font-mono text-xs transition-colors ${
            disabled
              ? "cursor-default text-[var(--text-disabled)]"
              : "text-foreground hover:bg-secondary"
          }`}
        >
          {value || (
            <span className="text-[var(--text-disabled)]">{disabled ? "—" : placeholder}</span>
          )}
        </button>
      )}
    </>
  );
}
