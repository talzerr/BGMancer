"use client";

import Link from "next/link";
import { MusicNote } from "@/components/ui/Icons";
import { outlineAmberCtaClass } from "@/components/ui/button";

const MOBILE_COVER_COUNT = 5;

export function LaunchpadEmpty({ previewCovers }: { previewCovers: string[] }) {
  // Show fewer covers on mobile to prevent horizontal viewport overflow:
  // 8 × 56px + 7 × 12px gap = 532px, which exceeds a 390px viewport. We use
  // CSS to hide the overflow covers on narrow viewports so the row stays
  // contained without requiring a responsive slice. Outer overflow-hidden
  // is a defence-in-depth against any similar regressions.
  return (
    <div className="flex w-full max-w-[600px] flex-col items-center overflow-hidden px-4 text-center">
      {previewCovers.length > 0 && (
        <div className="mb-8 flex w-full items-center justify-center gap-3 overflow-hidden">
          {previewCovers.map((url, i) => (
            <div
              key={i}
              className={`h-[56px] w-[56px] shrink-0 overflow-hidden rounded-lg opacity-[0.12] ${
                i >= MOBILE_COVER_COUNT ? "hidden sm:block" : ""
              }`}
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
      <p className="mt-1.5 text-[13px] font-normal text-[rgba(255,255,255,0.6)]">
        Pick your games, get a soundtrack mix
      </p>

      <Link href="/catalog" className={`${outlineAmberCtaClass("md")} mt-6`}>
        Browse catalog →
      </Link>
    </div>
  );
}
