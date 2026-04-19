"use client";

import Link from "next/link";
import { LogoLink } from "@/components/layout/LogoLink";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <LogoLink />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-text-tertiary font-mono text-[11px] tracking-wider uppercase">Error</p>
        <h1 className="text-foreground text-[17px] font-normal -tracking-[0.01em]">
          Something broke.
        </h1>
        <div className="mt-2 flex items-center gap-4">
          <button
            onClick={reset}
            className="text-primary hover:text-[var(--primary-hover)] text-[13px] font-medium"
          >
            Try again
          </button>
          <span className="text-text-tertiary text-[13px]">&middot;</span>
          <Link
            href="/"
            className="text-text-secondary hover:text-foreground text-[13px] font-medium"
          >
            Back to BGMancer &rarr;
          </Link>
        </div>
      </main>
    </div>
  );
}
