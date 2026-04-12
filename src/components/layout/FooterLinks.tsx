import Link from "next/link";
import Image from "next/image";

export function FooterLinks() {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 text-[11px] text-[var(--text-disabled)]">
        <a
          href="https://github.com/talzerr/bgmancer"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-[var(--text-tertiary)]"
        >
          Source
        </a>
        <span>·</span>
        <Link href="/legal" className="transition-colors hover:text-[var(--text-tertiary)]">
          Legal
        </Link>
        <span>·</span>
        <span>Discord: talzxc</span>
      </div>
      <a
        href="https://www.youtube.com"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Developed with YouTube"
        className="opacity-[0.22] transition-opacity hover:opacity-40"
      >
        <Image
          src="/brand/developed-with-youtube-dark.png"
          alt="Developed with YouTube"
          className="-ml-1"
          width={122}
          height={26}
          unoptimized
        />
      </a>
    </div>
  );
}
