"use client";

import { useEffect, useRef, useState } from "react";

const TOAST_DURATION_MS = 5000;

interface InfoToastProps {
  message: string;
  onDone: () => void;
}

export function InfoToast({ message, onDone }: InfoToastProps) {
  const [visible, setVisible] = useState(true);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDoneRef.current();
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="bg-secondary fixed right-4 bottom-24 z-50 flex items-center gap-3 rounded-xl border border-[var(--border-emphasis)] px-4 py-2.5">
      <span className="text-foreground text-sm">{message}</span>
      <div className="absolute right-0 bottom-0 left-0 h-0.5 overflow-hidden rounded-b-xl bg-[var(--surface-hover)]">
        <div
          className="bg-primary h-full"
          style={{
            animation: `shrink ${TOAST_DURATION_MS}ms linear forwards`,
            transformOrigin: "left",
          }}
        />
      </div>
    </div>
  );
}
