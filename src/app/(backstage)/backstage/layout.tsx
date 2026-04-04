import type { Metadata } from "next";
import Link from "next/link";
import { BackstageNav } from "@/components/backstage/BackstageNav";

export const metadata: Metadata = {
  title: "Backstage — BGMancer",
  description: "BGMancer admin control plane — inspect and correct track metadata.",
};

export default function BackstageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-screen font-mono">
      <header className="border-border bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-foreground text-sm font-medium tracking-tight">
              BGMancer Backstage
            </span>
            <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wider uppercase">
              Admin
            </span>
          </div>
          <Link
            href="/"
            className="hover:text-foreground text-xs text-[var(--text-tertiary)] transition-colors"
          >
            ← Back to app
          </Link>
        </div>
        <div className="mx-auto max-w-7xl">
          <BackstageNav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
