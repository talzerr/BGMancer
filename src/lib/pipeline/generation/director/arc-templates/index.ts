import { PlaylistMode } from "@/types";
import type { ArcTemplate } from "../types";
import { CHILL_ARC_TEMPLATE } from "./chill";
import { MIX_ARC_TEMPLATE } from "./mix";
import { RUSH_ARC_TEMPLATE } from "./rush";

export { JOURNEY_ARC_TEMPLATE } from "./journey";
export { CHILL_ARC_TEMPLATE } from "./chill";
export { MIX_ARC_TEMPLATE } from "./mix";
export { RUSH_ARC_TEMPLATE } from "./rush";

/** Returns the static template for an energy mode, or null for Journey. */
export function getEnergyModeTemplate(mode: PlaylistMode): ArcTemplate | null {
  switch (mode) {
    case PlaylistMode.Chill:
      return CHILL_ARC_TEMPLATE;
    case PlaylistMode.Mix:
      return MIX_ARC_TEMPLATE;
    case PlaylistMode.Rush:
      return RUSH_ARC_TEMPLATE;
    case PlaylistMode.Journey:
      return null;
  }
}
