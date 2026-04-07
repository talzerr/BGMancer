import Image from "next/image";
import Link from "next/link";
import { AuthButtons } from "@/components/AuthButtons";

interface HeaderProps {
  user: { name?: string | null; email?: string | null; image?: string | null } | null;
  isDev: boolean;
  nav?: React.ReactNode;
}

export function Header({ user, isDev, nav }: HeaderProps) {
  return (
    <header className="border-border isolation-isolate sticky top-0 z-40 border-b">
      {/* Frosted backdrop on a separate layer — backdrop-filter on the sticky element itself
          triggers a macOS Chrome compositor flicker bug. */}
      <div
        aria-hidden
        className="bg-background/80 absolute inset-0 -z-10 transform-gpu backdrop-blur-xl [will-change:transform]"
      />
      <div className="relative mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/icon-192.png"
            alt="BGMancer"
            width={32}
            height={32}
            className="h-8 w-8 shrink-0"
            priority
          />
          <div>
            <h1 className="font-display text-foreground text-[16px] leading-[1.2] font-semibold -tracking-[0.02em]">
              BGMancer
            </h1>
            <p className="mt-0.5 text-[11px] leading-none text-[var(--text-tertiary)]">
              Video game OST curator
            </p>
          </div>
        </Link>

        {nav ? (
          <div className="flex items-center gap-4">
            {nav}
            <AuthButtons user={user} isDev={isDev} />
          </div>
        ) : (
          <AuthButtons user={user} isDev={isDev} />
        )}
      </div>
    </header>
  );
}
