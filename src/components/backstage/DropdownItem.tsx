"use client";

export function DropdownItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-xs transition-colors ${
        destructive ? "text-rose-400 hover:bg-rose-500/10" : "text-zinc-300 hover:bg-zinc-800"
      }`}
    >
      {children}
    </button>
  );
}
