"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrackRole } from "@/types";

interface BulkActionBarProps {
  selectedCount: number;
  onSetEnergy: (energy: 1 | 2 | 3) => void;
  onSetRole: (role: string) => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onMarkReviewed: () => void;
  onDelete: () => void;
}

export function BulkActionBar({
  selectedCount,
  onSetEnergy,
  onSetRole,
  onActivate,
  onDeactivate,
  onMarkReviewed,
  onDelete,
}: BulkActionBarProps) {
  const [energyValue, setEnergyValue] = useState("");
  const [roleValue, setRoleValue] = useState("");

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/95 px-4 py-2.5 shadow-2xl backdrop-blur-sm">
      <span className="mr-1 text-xs text-zinc-400">
        <span className="font-semibold text-zinc-200">{selectedCount}</span> selected
      </span>

      <div className="h-4 w-px bg-zinc-700" />

      <Select
        value={energyValue}
        onValueChange={(v) => {
          if (!v) return;
          setEnergyValue(v);
          onSetEnergy(Number(v) as 1 | 2 | 3);
          setTimeout(() => setEnergyValue(""), 100);
        }}
      >
        <SelectTrigger className="h-7 w-28 border-zinc-700 bg-zinc-800 text-xs text-zinc-300">
          <SelectValue placeholder="Set energy" />
        </SelectTrigger>
        <SelectContent className="border-zinc-700 bg-zinc-900">
          <SelectItem value="1" className="text-xs text-sky-400">
            1 — Calm
          </SelectItem>
          <SelectItem value="2" className="text-xs text-amber-400">
            2 — Moderate
          </SelectItem>
          <SelectItem value="3" className="text-xs text-rose-400">
            3 — Intense
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={roleValue}
        onValueChange={(v) => {
          if (!v) return;
          setRoleValue(v);
          onSetRole(v);
          setTimeout(() => setRoleValue(""), 100);
        }}
      >
        <SelectTrigger className="h-7 w-28 border-zinc-700 bg-zinc-800 text-xs text-zinc-300">
          <SelectValue placeholder="Set role" />
        </SelectTrigger>
        <SelectContent className="border-zinc-700 bg-zinc-900">
          {Object.values(TrackRole).map((r) => (
            <SelectItem key={r} value={r} className="text-xs text-zinc-300 capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-4 w-px bg-zinc-700" />

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-zinc-300 hover:text-zinc-100"
        onClick={onActivate}
      >
        Activate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-zinc-300 hover:text-zinc-100"
        onClick={onDeactivate}
      >
        Deactivate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-zinc-300 hover:text-zinc-100"
        onClick={onMarkReviewed}
      >
        Mark reviewed
      </Button>

      <div className="h-4 w-px bg-zinc-700" />

      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
        onClick={onDelete}
      >
        Delete
      </Button>
    </div>
  );
}
