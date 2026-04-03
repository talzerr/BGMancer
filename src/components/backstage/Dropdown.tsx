"use client";

import { Button } from "@/components/ui/button";

interface DropdownProps {
  label: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  buttonClassName?: string;
  width?: string;
  children: React.ReactNode;
}

export function Dropdown({
  label,
  open,
  onOpenChange,
  disabled,
  buttonClassName = "h-7 border-zinc-700 text-xs text-zinc-300 hover:text-zinc-100",
  width = "w-48",
  children,
}: DropdownProps) {
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        className={buttonClassName}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        onBlur={() => setTimeout(() => onOpenChange(false), 150)}
      >
        {label}
      </Button>
      {open && (
        <div
          className={`absolute right-0 z-10 mt-1 ${width} rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-lg`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
