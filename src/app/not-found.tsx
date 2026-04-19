import Link from "next/link";
import { LogoLink } from "@/components/layout/LogoLink";

export default function NotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-4 pt-4 sm:px-6">
        <LogoLink />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-text-tertiary font-mono text-[11px] tracking-wider uppercase">404</p>
        <h1 className="text-foreground text-[17px] font-normal -tracking-[0.01em]">
          This page doesn&apos;t exist.
        </h1>
        <Link
          href="/"
          className="text-primary hover:text-[var(--primary-hover)] mt-2 text-[13px] font-medium"
        >
          Back to BGMancer &rarr;
        </Link>
      </main>
    </div>
  );
}
