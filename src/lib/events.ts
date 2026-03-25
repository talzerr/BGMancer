import { EventEmitter } from "events";
import type { OnboardingPhase } from "@/types";

// ─── Event payloads ───────────────────────────────────────────────────────────

export interface GameStatusPayload {
  gameId: string;
  phase: OnboardingPhase;
}

// ─── App event map ────────────────────────────────────────────────────────────
// Add new events here. Each key maps to a tuple of its listener argument types.

interface AppEvents {
  "game:status": [payload: GameStatusPayload];
}

// ─── Singleton bus ────────────────────────────────────────────────────────────
// One instance per process. ES module caching guarantees this is shared across all imports.
// Max listeners raised to 100 to support many concurrent SSE connections without warnings.

export const bus = new EventEmitter<AppEvents>();
bus.setMaxListeners(100);
