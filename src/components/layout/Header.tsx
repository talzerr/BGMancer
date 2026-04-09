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
    <header>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 pt-[18px] sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/icon-192.png"
            alt="BGMancer"
            width={20}
            height={20}
            className="h-5 w-5 shrink-0"
            priority
          />
          <h1 className="font-display text-foreground text-[15px] leading-[1.2] font-semibold -tracking-[0.03em]">
            BGMancer
          </h1>
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
