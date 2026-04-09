import Link from "next/link";

export function FooterLinks() {
  return (
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
  );
}
