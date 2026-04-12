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
    <div className="border-border bg-secondary/95 fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-2.5 backdrop-blur-sm">
      <span className="text-muted-foreground mr-1 text-xs">
        <span className="text-foreground font-medium">{selectedCount}</span> selected
      </span>

      <div className="h-4 w-px bg-[var(--border-emphasis)]" />

      <Select
        value={energyValue}
        onValueChange={(v) => {
          if (!v) return;
          setEnergyValue(v);
          onSetEnergy(Number(v) as 1 | 2 | 3);
          setTimeout(() => setEnergyValue(""), 100);
        }}
      >
        <SelectTrigger className="border-border bg-secondary text-foreground h-7 w-28 text-xs">
          <SelectValue placeholder="Set energy" />
        </SelectTrigger>
        <SelectContent className="border-border bg-secondary">
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
        <SelectTrigger className="border-border bg-secondary text-foreground h-7 w-28 text-xs">
          <SelectValue placeholder="Set role" />
        </SelectTrigger>
        <SelectContent className="border-border bg-secondary">
          {Object.values(TrackRole).map((r) => (
            <SelectItem key={r} value={r} className="text-foreground text-xs capitalize">
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="h-4 w-px bg-[var(--border-emphasis)]" />

      <Button
        size="sm"
        variant="ghost"
        className="text-foreground hover:text-foreground h-7 px-2 text-xs"
        onClick={onActivate}
      >
        Activate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-foreground hover:text-foreground h-7 px-2 text-xs"
        onClick={onDeactivate}
      >
        Deactivate
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-foreground hover:text-foreground h-7 px-2 text-xs"
        onClick={onMarkReviewed}
      >
        Mark reviewed
      </Button>

      <div className="h-4 w-px bg-[var(--border-emphasis)]" />

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
