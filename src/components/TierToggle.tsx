"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserTier } from "@/types";

interface TierToggleProps {
  initialTier: UserTier;
}

// TODO: clean up — dev-only tier toggle; remove or gate behind env flag before any public deploy
export function TierToggle({ initialTier }: TierToggleProps) {
  const [tier, setTier] = useState(initialTier);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function toggle() {
    const res = await fetch("/api/user/tier", { method: "POST" });
    if (!res.ok) return;
    const { tier: next } = (await res.json()) as { tier: UserTier };
    setTier(next);
    startTransition(() => router.refresh());
  }

  const isMaestro = tier === UserTier.Maestro;

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={`Switch to ${isMaestro ? "Bard" : "Maestro"}`}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide transition-colors disabled:opacity-50 ${
        isMaestro
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
          : "border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-300"
      }`}
    >
      {isMaestro ? "🎼 Maestro" : "🪕 Bard"}
    </button>
  );
}
