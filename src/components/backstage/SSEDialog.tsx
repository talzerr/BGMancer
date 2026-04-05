"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SSEProgress } from "@/components/backstage/SSEProgress";

type SSEEvent = Record<string, unknown>;

interface SSEDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  sseRunning: boolean;
  url: string;
  body: Record<string, unknown>;
  progressLabel?: (event: SSEEvent) => string;
  doneLabel?: (event: SSEEvent) => string;
  onDone: () => void;
  onClose: () => void;
}

export function SSEDialog({
  open,
  onOpenChange,
  title,
  description,
  sseRunning,
  url,
  body,
  progressLabel,
  doneLabel,
  onDone,
  onClose,
}: SSEDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !sseRunning && onOpenChange(false)}>
      <DialogContent className="border-border bg-secondary" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-foreground">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>
        <SSEProgress
          url={url}
          body={body}
          progressLabel={progressLabel}
          doneLabel={doneLabel}
          onDone={onDone}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
