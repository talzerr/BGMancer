"use client";

import { useEffect, useRef, useState } from "react";

const SAMPLE_SIZE = 16;

/** Returns an RGB triplet like "120, 80, 60" or null on failure. */
function extractDominantColor(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;

    let bestSat = 0;
    let bestR = 128,
      bestG = 128,
      bestB = 128;

    for (let i = 0; i < data.length; i += 16) {
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      if (sat > bestSat) {
        bestSat = sat;
        bestR = r;
        bestG = g;
        bestB = b;
      }
    }

    // Boost saturation slightly and keep bright — applied at low opacity on the row
    const avg = (bestR + bestG + bestB) / 3;
    const boost = 1.3; // 30% saturation boost for visibility at low opacity
    const r = Math.min(255, Math.round(avg + (bestR - avg) * boost));
    const g = Math.min(255, Math.round(avg + (bestG - avg) * boost));
    const b = Math.min(255, Math.round(avg + (bestB - avg) * boost));

    return `${r}, ${g}, ${b}`;
  } catch {
    return null;
  }
}

interface GameThumbnail {
  gameId: string;
  url: string;
}

export function useGameAccentColors(games: GameThumbnail[]): Map<string, string> {
  const [colors, setColors] = useState<Map<string, string>>(new Map());
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (games.length === 0) return;

    const pending: GameThumbnail[] = [];

    for (const g of games) {
      if (!cacheRef.current.has(g.gameId)) {
        pending.push(g);
      }
    }

    if (pending.length === 0) {
      if (cacheRef.current.size !== colors.size) setColors(new Map(cacheRef.current));
      return;
    }

    let cancelled = false;
    let resolved = 0;

    function flush() {
      if (!cancelled) setColors(new Map(cacheRef.current));
    }

    for (const g of pending) {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const color = extractDominantColor(img);
        if (color) cacheRef.current.set(g.gameId, color);
        if (++resolved === pending.length) flush();
      };
      img.onerror = () => {
        if (cancelled) return;
        if (++resolved === pending.length) flush();
      };
      img.src = g.url;
    }

    return () => {
      cancelled = true;
    };
  }, [games, colors.size]);

  return colors;
}
