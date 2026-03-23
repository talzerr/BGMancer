import type { Metadata } from "next";
import Link from "next/link";
import { BackstageNav } from "@/components/backstage/BackstageNav";

export const metadata: Metadata = {
  title: "Backstage — BGMancer",
  description: "BGMancer admin control plane — inspect and correct track metadata.",
};

export default function BackstageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 font-mono">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              BGMancer Backstage
            </span>
            <span className="rounded bg-violet-900/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-violet-400 uppercase">
              Admin
            </span>
          </div>
          <Link href="/" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
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
