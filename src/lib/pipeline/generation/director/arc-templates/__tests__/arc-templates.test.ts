import { describe, it, expect } from "vitest";
import { ArcPhase, PlaylistMode, TrackMood } from "@/types";
import { CHILL_ARC_TEMPLATE, MIX_ARC_TEMPLATE, RUSH_ARC_TEMPLATE, getEnergyModeTemplate } from "..";

describe("Chill template", () => {
  it("is a single Steady phase at 100% share", () => {
    expect(CHILL_ARC_TEMPLATE).toHaveLength(1);
    expect(CHILL_ARC_TEMPLATE[0].phase).toBe(ArcPhase.Steady);
    expect(CHILL_ARC_TEMPLATE[0].fraction).toBe(1);
  });

  it("allows energy 1 and 2 only", () => {
    expect(CHILL_ARC_TEMPLATE[0].energyPrefs).toEqual([1, 2]);
  });

  it("penalizes high-intensity moods", () => {
    expect(CHILL_ARC_TEMPLATE[0].penalizedMoods).toContain(TrackMood.Epic);
    expect(CHILL_ARC_TEMPLATE[0].penalizedMoods).toContain(TrackMood.Chaotic);
  });
});

describe("Mix template", () => {
  it("is a single Steady phase at 100% share", () => {
    expect(MIX_ARC_TEMPLATE).toHaveLength(1);
    expect(MIX_ARC_TEMPLATE[0].phase).toBe(ArcPhase.Steady);
    expect(MIX_ARC_TEMPLATE[0].fraction).toBe(1);
  });

  it("allows all three energy levels", () => {
    expect(MIX_ARC_TEMPLATE[0].energyPrefs).toEqual([1, 2, 3]);
  });

  it("has no mood preferences or penalties", () => {
    expect(MIX_ARC_TEMPLATE[0].preferredMoods).toEqual([]);
    expect(MIX_ARC_TEMPLATE[0].penalizedMoods).toEqual([]);
  });
});

describe("Rush template", () => {
  it("is a single Steady phase at 100% share", () => {
    expect(RUSH_ARC_TEMPLATE).toHaveLength(1);
    expect(RUSH_ARC_TEMPLATE[0].phase).toBe(ArcPhase.Steady);
    expect(RUSH_ARC_TEMPLATE[0].fraction).toBe(1);
  });

  it("allows energy 2 and 3 only", () => {
    expect(RUSH_ARC_TEMPLATE[0].energyPrefs).toEqual([2, 3]);
  });

  it("penalizes soft moods", () => {
    expect(RUSH_ARC_TEMPLATE[0].penalizedMoods).toContain(TrackMood.Peaceful);
    expect(RUSH_ARC_TEMPLATE[0].penalizedMoods).toContain(TrackMood.Serene);
  });
});

describe("getEnergyModeTemplate", () => {
  it("returns null for Journey", () => {
    expect(getEnergyModeTemplate(PlaylistMode.Journey)).toBeNull();
  });

  it("returns the Chill template for Chill mode", () => {
    expect(getEnergyModeTemplate(PlaylistMode.Chill)).toBe(CHILL_ARC_TEMPLATE);
  });

  it("returns the Mix template for Mix mode", () => {
    expect(getEnergyModeTemplate(PlaylistMode.Mix)).toBe(MIX_ARC_TEMPLATE);
  });

  it("returns the Rush template for Rush mode", () => {
    expect(getEnergyModeTemplate(PlaylistMode.Rush)).toBe(RUSH_ARC_TEMPLATE);
  });
});
