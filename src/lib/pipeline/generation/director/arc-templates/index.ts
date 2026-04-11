import { PlaylistMode } from "@/types";
import type { ArcTemplate } from "../types";
import { JOURNEY_ARC_TEMPLATE } from "./journey";
import { CHILL_ARC_TEMPLATE } from "./chill";
import { MIX_ARC_TEMPLATE } from "./mix";
import { RUSH_ARC_TEMPLATE } from "./rush";

// Tests in this folder import the individual templates from "..".
export { JOURNEY_ARC_TEMPLATE, CHILL_ARC_TEMPLATE, MIX_ARC_TEMPLATE, RUSH_ARC_TEMPLATE };

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
