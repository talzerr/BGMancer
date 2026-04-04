"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** If set, user must type this string to enable the confirm button */
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
  destructive?: boolean;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  typeToConfirm,
  onConfirm,
  destructive = false,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState("");

  const canConfirm = !typeToConfirm || typed === typeToConfirm;

  async function handleConfirm() {
    if (!canConfirm) return;
    await onConfirm();
    setTyped("");
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setTyped("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="border-border bg-secondary">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        {typeToConfirm && (
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-xs">
              Type <span className="text-foreground font-mono">{typeToConfirm}</span> to confirm
            </p>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={typeToConfirm}
              className="border-border bg-background text-foreground font-mono placeholder:text-[var(--text-disabled)]"
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setTyped("");
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
