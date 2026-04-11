"use client";

import Link from "next/link";
import { MusicNote } from "@/components/Icons";
import { outlineAmberCtaClass } from "@/components/ui/button";

export function LaunchpadEmpty({ previewCovers }: { previewCovers: string[] }) {
  return (
    <div className="flex max-w-[600px] flex-col items-center text-center">
      {previewCovers.length > 0 && (
        <div className="mb-8 flex items-center gap-3">
          {previewCovers.map((url, i) => (
            <div
              key={i}
              className="h-[56px] w-[56px] shrink-0 overflow-hidden rounded-lg opacity-[0.12]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                width={56}
                height={56}
                loading="eager"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      <MusicNote className="h-8 w-8 text-[rgba(255,255,255,0.25)]" />

      <p className="mt-4 text-[17px] leading-[1.4] font-normal -tracking-[0.01em] text-[rgba(255,255,255,0.6)]">
        Playlists from the games you&apos;ve played
      </p>
      <p className="mt-1.5 text-[13px] font-normal text-[rgba(255,255,255,0.3)]">
        Pick your games, get a soundtrack mix
      </p>

      <Link href="/catalog" className={`${outlineAmberCtaClass("md")} mt-6`}>
        Browse catalog →
      </Link>
    </div>
  );
}
