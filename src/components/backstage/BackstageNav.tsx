"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Dashboard", href: "/backstage", exact: true },
  { label: "Games", href: "/backstage/games" },
  { label: "Tracks", href: "/backstage/tracks" },
  { label: "Theatre", href: "/backstage/theatre" },
  { label: "Requests", href: "/backstage/requests" },
] as const;

export function BackstageNav() {
  const pathname = usePathname();

  return (
    <nav className="border-border flex gap-1 border-b px-4">
      {TABS.map((tab) => {
        const active =
          "exact" in tab && tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative px-3 py-2 text-xs font-medium transition-colors",
              active ? "text-primary" : "hover:text-foreground text-[var(--text-tertiary)]",
            )}
          >
            {tab.label}
            {active && <span className="bg-primary absolute inset-x-0 -bottom-px h-px" />}
          </Link>
        );
      })}
    </nav>
  );
}
