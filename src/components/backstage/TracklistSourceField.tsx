"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  parseSource,
  formatSource,
  sourceUrl,
  getRegisteredSources,
} from "@/lib/services/tracklist-source";

export function TracklistSourceField({
  value,
  disabled,
  onSave,
}: {
  value: string | null;
  disabled?: boolean;
  onSave: (value: string | null) => void;
}) {
  const sources = getRegisteredSources();
  const parsed = parseSource(value);
  const [sourceKey, setSourceKey] = useState(parsed?.key ?? "");
  const [sourceId, setSourceId] = useState(parsed?.id ?? "");

  const href = sourceUrl(sourceKey && sourceId ? formatSource(sourceKey, sourceId) : null);
  const isDirty = sourceKey !== (parsed?.key ?? "") || sourceId !== (parsed?.id ?? "");

  function save() {
    if (!isDirty) return;
    onSave(sourceKey && sourceId ? formatSource(sourceKey, sourceId) : null);
  }

  return (
    <>
      <span className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
        Tracklist Source
        {href && sourceId && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-600 transition-colors hover:text-zinc-300"
          >
            ↗
          </a>
        )}
      </span>
      <div className="flex items-center gap-2">
        <Select
          value={sourceKey}
          onValueChange={(v) => {
            const next = v || "";
            setSourceKey(next);
            if (!next) {
              setSourceId("");
              onSave(null);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="h-7 w-auto min-w-[130px] border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300">
            <span className="flex flex-1 text-left">
              {sources.find((s) => s.key === sourceKey)?.label ?? "Auto-discover"}
            </span>
          </SelectTrigger>
          <SelectContent className="border-zinc-700 bg-zinc-900">
            <SelectItem value="" className="text-xs text-zinc-400">
              Auto-discover
            </SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-xs text-zinc-300">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sourceKey && (
          <Input
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value.replace(/\D/g, ""))}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
            placeholder="ID"
            disabled={disabled}
            className="h-7 w-24 border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-300"
          />
        )}
        {isDirty && sourceKey && sourceId && (
          <button onClick={save} className="text-[10px] text-emerald-500 hover:text-emerald-400">
            Save
          </button>
        )}
      </div>
    </>
  );
}
