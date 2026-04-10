"use client";

import { useEffect, useRef, useState } from "react";

const NO_COLOR = "";
const SAMPLE_SIZE = 16;

function extractDominantColor(img: HTMLImageElement): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return NO_COLOR;

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
    return NO_COLOR;
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
    const next = new Map(cacheRef.current);

    for (const g of games) {
      if (!cacheRef.current.has(g.gameId)) {
        pending.push(g);
      }
    }

    if (pending.length === 0) {
      // All cached — sync state if needed
      if (next.size !== colors.size) setColors(next);
      return;
    }

    let cancelled = false;
    let resolved = 0;

    for (const g of pending) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        const color = extractDominantColor(img);
        cacheRef.current.set(g.gameId, color);
        resolved++;
        if (resolved === pending.length) {
          setColors(new Map(cacheRef.current));
        }
      };
      img.onerror = () => {
        if (cancelled) return;
        cacheRef.current.set(g.gameId, NO_COLOR);
        resolved++;
        if (resolved === pending.length) {
          setColors(new Map(cacheRef.current));
        }
      };
      img.src = g.url;
    }

    return () => {
      cancelled = true;
    };
  }, [games, colors.size]);

  return colors;
}
