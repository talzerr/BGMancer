import Image from "next/image";
import Link from "next/link";

export function LogoLink() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <Image
        src="/icon-192.png"
        alt="BGMancer"
        width={20}
        height={20}
        className="h-5 w-5 shrink-0"
        priority
      />
      <h1 className="font-display text-foreground text-[13px] leading-[1.2] font-semibold -tracking-[0.03em]">
        BGMancer
      </h1>
    </Link>
  );
}
