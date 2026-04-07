import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  jaccard,
  expandArc,
  shuffle,
  computeGlobalHeat,
  computeViewBiasScores,
  computeGameBudgets,
  scoreTrack,
  weightedTopN,
  pickBestTrack,
  assemblePlaylist,
  ARC_TEMPLATE,
  ZERO_BREAKDOWN,
} from "../director";
import type { ArcSlot } from "../director";
import type { TaggedTrack, Game, VibeRubric } from "@/types";
import {
  ArcPhase,
  CurationMode,
  TrackRole,
  TrackMood,
  TrackInstrumentation,
  SelectionPass,
} from "@/types";
import {
  SCORE_WEIGHT_ROLE,
  SCORE_WEIGHT_MOOD,
  SCORE_WEIGHT_INSTRUMENT,
  SCORE_WEIGHT_ROLE_VIEW_BIAS,
  SCORE_WEIGHT_MOOD_VIEW_BIAS,
  SCORE_WEIGHT_VIEW_BIAS,
  SCORE_WEIGHT_INSTRUMENT_VIEW_BIAS,
  VIEW_BIAS_SCORE_BASELINE,
  SCORE_PENALTY_MULTIPLIER,
  SCORE_VOCALS_PENALTY_MULTIPLIER,
  DIRECTOR_TOP_N_POOL,
} from "@/lib/constants";

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── File-level constants (not in shared constants) ─────────────────────────

const DEFAULT_GAME_ID = "game-1";
const DEFAULT_GAME_TITLE = "Test Game";
const DEFAULT_TRACK_TITLE = "Test Track";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTrack(overrides: Partial<TaggedTrack> = {}): TaggedTrack {
  return {
    videoId: `vid-${Math.random().toString(36).slice(2, 8)}`,
    title: DEFAULT_TRACK_TITLE,
    gameId: DEFAULT_GAME_ID,
    gameTitle: DEFAULT_GAME_TITLE,
    energy: 2,
    roles: [TrackRole.Ambient],
    moods: [TrackMood.Peaceful],
    instrumentation: [TrackInstrumentation.Piano],
    hasVocals: false,
    durationSeconds: 180,
    viewCount: null,
    ...overrides,
  };
}

function makeGame(overrides: Partial<Game> = {}): Game {
  return {
    id: DEFAULT_GAME_ID,
    title: DEFAULT_GAME_TITLE,
    curation: CurationMode.Include,
    steam_appid: null,
    onboarding_phase: "tagged" as Game["onboarding_phase"],
    published: true,
    tracklist_source: null,
    yt_playlist_id: null,
    thumbnail_url: null,
    needs_review: false,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function makeSlot(overrides: Partial<ArcSlot> = {}): ArcSlot {
  return {
    phase: ArcPhase.Rising,
    energyPrefs: [2],
    rolePrefs: [TrackRole.Ambient],
    preferredMoods: [TrackMood.Peaceful],
    penalizedMoods: [TrackMood.Chaotic],
    preferredInstrumentation: [TrackInstrumentation.Piano],
    ...overrides,
  };
}

function makeRubric(overrides: Partial<VibeRubric> = {}): VibeRubric {
  return {
    phases: {},
    penalizedMoods: [],
    allowVocals: null,
    ...overrides,
  };
}

// ─── jaccard ────────────────────────────────────────────────────────────────

describe("jaccard", () => {
  describe("when sets are identical", () => {
    it("should return 1.0", () => {
      expect(jaccard(["a", "b"], ["a", "b"])).toBe(1.0);
    });
  });

  describe("when sets are completely disjoint", () => {
    it("should return 0.0", () => {
      expect(jaccard(["a"], ["b"])).toBe(0.0);
    });
  });

  describe("when sets partially overlap", () => {
    it("should return intersection/union ratio", () => {
      expect(jaccard(["a", "b", "c"], ["b", "c", "d"])).toBe(2 / 4);
    });
  });

  describe("when both sets are empty", () => {
    it("should return 0", () => {
      expect(jaccard([], [])).toBe(0);
    });
  });

  describe("when one set is empty", () => {
    it("should return 0", () => {
      expect(jaccard(["a"], [])).toBe(0);
      expect(jaccard([], ["b"])).toBe(0);
    });
  });

  describe("when inputs contain duplicates", () => {
    it("should use set semantics", () => {
      expect(jaccard(["a", "a"], ["a"])).toBe(1.0);
    });
  });
});

// ─── shuffle ────────────────────────────────────────────────────────────────

describe("shuffle", () => {
  it("should return a new array with the same elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(result.sort()).toEqual(input.sort());
  });

  describe("when given an empty array", () => {
    it("should return an empty array", () => {
      expect(shuffle([])).toEqual([]);
    });
  });

  describe("when given a single-element array", () => {
    it("should return the same element", () => {
      expect(shuffle([42])).toEqual([42]);
    });
  });
});

// ─── expandArc ──────────────────────────────────────────────────────────────

describe("expandArc", () => {
  describe("when generating slots for various target counts", () => {
    it("should return exactly targetCount slots", () => {
      for (const count of [6, 10, 20, 50, 100]) {
        expect(expandArc(count)).toHaveLength(count);
      }
    });
  });

  describe("when examining phase ordering", () => {
    it("should start with Intro", () => {
      expect(expandArc(50)[0].phase).toBe(ArcPhase.Intro);
    });

    it("should end with Outro", () => {
      const slots = expandArc(50);
      expect(slots[slots.length - 1].phase).toBe(ArcPhase.Outro);
    });

    it("should contain all 6 phases", () => {
      const phases = new Set(expandArc(50).map((s) => s.phase));
      expect(phases.size).toBe(6);
    });
  });

  describe("when checking template fraction distribution", () => {
    it("should approximately match the ARC_TEMPLATE fractions", () => {
      const slots = expandArc(100);
      const counts = new Map<ArcPhase, number>();
      for (const slot of slots) {
        counts.set(slot.phase, (counts.get(slot.phase) ?? 0) + 1);
      }
      for (const template of ARC_TEMPLATE) {
        const count = counts.get(template.phase) ?? 0;
        expect(count).toBeGreaterThanOrEqual(Math.floor(100 * template.fraction) - 5);
        expect(count).toBeLessThanOrEqual(Math.ceil(100 * template.fraction) + 5);
      }
    });
  });

  describe("when targetCount equals number of phases (6)", () => {
    it("should produce one slot per phase", () => {
      const phases = new Set(expandArc(6).map((s) => s.phase));
      expect(phases.size).toBe(6);
    });
  });

  describe("when examining slot preferences", () => {
    it("should carry energy and role preferences from template", () => {
      const introSlot = expandArc(10).find((s) => s.phase === ArcPhase.Intro)!;
      expect(introSlot.energyPrefs).toEqual([1, 2]);
      expect(introSlot.rolePrefs).toContain(TrackRole.Opener);
    });
  });
});

// ─── computeGlobalHeat ──────────────────────────────────────────────────────

describe("computeGlobalHeat", () => {
  describe("when viewCount is null, zero, or negative", () => {
    it("should return baseline", () => {
      expect(computeGlobalHeat(null)).toBe(VIEW_BIAS_SCORE_BASELINE);
      expect(computeGlobalHeat(0)).toBe(VIEW_BIAS_SCORE_BASELINE);
      expect(computeGlobalHeat(-100)).toBe(VIEW_BIAS_SCORE_BASELINE);
    });
  });

  describe("when viewCount is at the log boundaries", () => {
    it("should return 0 at 1,000 views (log10=3, lower bound)", () => {
      expect(computeGlobalHeat(1000)).toBe(0);
    });

    it("should return 1.0 at 10,000,000 views (log10=7, upper bound)", () => {
      expect(computeGlobalHeat(10_000_000)).toBe(1.0);
    });
  });

  describe("when viewCount is in the mid range", () => {
    it("should return a value between 0 and 1", () => {
      const heat = computeGlobalHeat(100_000);
      expect(heat).toBeGreaterThan(0);
      expect(heat).toBeLessThan(1);
      expect(heat).toBeCloseTo(0.5, 1);
    });
  });

  describe("when viewCount is outside the range", () => {
    it("should clamp below 0 to 0", () => {
      expect(computeGlobalHeat(500)).toBe(0);
    });

    it("should clamp above 1 to 1", () => {
      expect(computeGlobalHeat(1_000_000_000)).toBe(1.0);
    });
  });
});

// ─── computeViewBiasScores ──────────────────────────────────────────────────

describe("computeViewBiasScores", () => {
  describe("when all tracks have null viewCount", () => {
    it("should return baseline score", () => {
      const pools = new Map([[DEFAULT_GAME_ID, [makeTrack({ videoId: "v1", viewCount: null })]]]);
      expect(computeViewBiasScores(pools).get("v1")).toBeCloseTo(0.3, 5);
    });
  });

  describe("when tracks have varying view counts within a game", () => {
    it("should score higher-view tracks higher", () => {
      const pools = new Map([
        [
          DEFAULT_GAME_ID,
          [
            makeTrack({ videoId: "v1", viewCount: 1_000_000 }),
            makeTrack({ videoId: "v2", viewCount: 100_000 }),
          ],
        ],
      ]);
      const scores = computeViewBiasScores(pools);
      expect(scores.get("v1")!).toBeGreaterThan(scores.get("v2")!);
    });
  });

  describe("when pools span multiple games", () => {
    it("should return an entry for every track", () => {
      const pools = new Map([
        [DEFAULT_GAME_ID, [makeTrack({ videoId: "v1" })]],
        ["game-2", [makeTrack({ videoId: "v2" }), makeTrack({ videoId: "v3" })]],
      ]);
      expect(computeViewBiasScores(pools).size).toBe(3);
    });
  });

  describe("when a track has viewCount of 0", () => {
    it("should return baseline score", () => {
      const pools = new Map([[DEFAULT_GAME_ID, [makeTrack({ videoId: "v1", viewCount: 0 })]]]);
      expect(computeViewBiasScores(pools).get("v1")).toBeCloseTo(0.3, 5);
    });
  });
});

// ─── computeGameBudgets ─────────────────────────────────────────────────────

describe("computeGameBudgets", () => {
  describe("when there is a single Include game with large pool", () => {
    it("should assign full target", () => {
      const budgets = computeGameBudgets(
        [makeGame()],
        new Map([[DEFAULT_GAME_ID, Array.from({ length: 50 }, () => makeTrack())]]),
        20,
      );
      expect(budgets.get(DEFAULT_GAME_ID)).toBe(20);
    });
  });

  describe("when there are two equally weighted games", () => {
    it("should sum to targetCount", () => {
      const budgets = computeGameBudgets(
        [makeGame({ id: "g1" }), makeGame({ id: "g2" })],
        new Map([
          ["g1", Array.from({ length: 50 }, () => makeTrack())],
          ["g2", Array.from({ length: 50 }, () => makeTrack())],
        ]),
        20,
      );
      expect((budgets.get("g1") ?? 0) + (budgets.get("g2") ?? 0)).toBe(20);
    });
  });

  describe("when a game has Focus curation", () => {
    it("should receive 2x weight", () => {
      const budgets = computeGameBudgets(
        [makeGame({ id: "g1", curation: CurationMode.Focus }), makeGame({ id: "g2" })],
        new Map([
          ["g1", Array.from({ length: 50 }, () => makeTrack())],
          ["g2", Array.from({ length: 50 }, () => makeTrack())],
        ]),
        30,
      );
      expect(budgets.get("g1")).toBe(20);
      expect(budgets.get("g2")).toBe(10);
    });
  });

  describe("when a game has Lite curation", () => {
    it("should receive less weight than Include games", () => {
      const budgets = computeGameBudgets(
        [
          makeGame({ id: "g1", curation: CurationMode.Lite }),
          makeGame({ id: "g2" }),
          makeGame({ id: "g3" }),
        ],
        new Map([
          ["g1", Array.from({ length: 50 }, () => makeTrack())],
          ["g2", Array.from({ length: 50 }, () => makeTrack())],
          ["g3", Array.from({ length: 50 }, () => makeTrack())],
        ]),
        25,
      );
      expect(budgets.get("g1")!).toBeLessThan(budgets.get("g2")!);
      expect(budgets.get("g1")!).toBeLessThan(budgets.get("g3")!);
    });
  });

  describe("when pool size is smaller than raw budget", () => {
    it("should cap at pool size", () => {
      const budgets = computeGameBudgets(
        [makeGame({ id: "g1" })],
        new Map([["g1", [makeTrack(), makeTrack(), makeTrack()]]]),
        50,
      );
      expect(budgets.get("g1")).toBe(3);
    });
  });

  describe("when the 40% soft cap applies", () => {
    it("should redistribute leftover to other games", () => {
      const budgets = computeGameBudgets(
        [
          makeGame({ id: "g1", curation: CurationMode.Focus }),
          makeGame({ id: "g2" }),
          makeGame({ id: "g3" }),
        ],
        new Map([
          ["g1", Array.from({ length: 100 }, () => makeTrack())],
          ["g2", Array.from({ length: 5 }, () => makeTrack())],
          ["g3", Array.from({ length: 5 }, () => makeTrack())],
        ]),
        50,
      );
      const total = [...budgets.values()].reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(50);
      expect(budgets.get("g2")!).toBeLessThanOrEqual(5);
      expect(budgets.get("g3")!).toBeLessThanOrEqual(5);
    });
  });

  describe("when one game's pool is exhausted early", () => {
    it("should redistribute leftover to the other game", () => {
      const budgets = computeGameBudgets(
        [makeGame({ id: "g1" }), makeGame({ id: "g2" })],
        new Map([
          ["g1", [makeTrack()]],
          ["g2", Array.from({ length: 50 }, () => makeTrack())],
        ]),
        20,
      );
      expect(budgets.get("g1")).toBe(1);
      expect(budgets.get("g2")!).toBeGreaterThan(10);
    });
  });

  describe("when no active games exist", () => {
    it("should return empty map", () => {
      const budgets = computeGameBudgets(
        [makeGame()],
        new Map(), // no tracks in pool for any game
        20,
      );
      expect(budgets.size).toBe(0);
    });
  });

  describe("when a game has an empty pool", () => {
    it("should be excluded from budgets", () => {
      const budgets = computeGameBudgets(
        [makeGame({ id: "g1" }), makeGame({ id: "g2" })],
        new Map<string, TaggedTrack[]>([
          ["g1", []],
          ["g2", Array.from({ length: 20 }, () => makeTrack())],
        ]),
        10,
      );
      expect(budgets.has("g1")).toBe(false);
      expect(budgets.get("g2")).toBe(10);
    });
  });
});

// ─── scoreTrack ─────────────────────────────────────────────────────────────

describe("scoreTrack", () => {
  const slot = makeSlot();

  describe("when track energy does not match slot", () => {
    it("should return null", () => {
      expect(scoreTrack(makeTrack({ energy: 3 }), slot, undefined, null)).toBeNull();
    });
  });

  describe("when track energy matches slot", () => {
    it("should return a score breakdown", () => {
      expect(scoreTrack(makeTrack({ energy: 2 }), slot, undefined, null)).not.toBeNull();
    });
  });

  describe("when computing roleScore", () => {
    describe("when track role matches slot rolePrefs", () => {
      it("should be 1.0", () => {
        const result = scoreTrack(
          makeTrack({ energy: 2, roles: [TrackRole.Ambient] }),
          slot,
          undefined,
          null,
        )!;
        expect(result.roleScore).toBe(1.0);
      });
    });

    describe("when track role matches only rubric preferredRoles", () => {
      it("should be 1.0", () => {
        const s = makeSlot({ rolePrefs: [TrackRole.Ambient] });
        const rubric = makeRubric({
          phases: {
            [ArcPhase.Rising]: {
              preferredMoods: [],
              preferredInstrumentation: [],
              preferredRoles: [TrackRole.Combat],
            },
          },
        });
        const result = scoreTrack(
          makeTrack({ energy: 2, roles: [TrackRole.Combat] }),
          s,
          rubric,
          null,
        )!;
        expect(result.roleScore).toBe(1.0);
      });
    });

    describe("when no role matches slot or rubric", () => {
      it("should be 0.0", () => {
        const s = makeSlot({ rolePrefs: [TrackRole.Ambient] });
        const result = scoreTrack(
          makeTrack({ energy: 2, roles: [TrackRole.Combat] }),
          s,
          undefined,
          null,
        )!;
        expect(result.roleScore).toBe(0.0);
      });
    });
  });

  describe("when computing moodScore", () => {
    it("should use Jaccard of track moods vs slot preferredMoods", () => {
      const s = makeSlot({ preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious] });
      const result = scoreTrack(
        makeTrack({ energy: 2, moods: [TrackMood.Peaceful, TrackMood.Nostalgic] }),
        s,
        undefined,
        null,
      )!;
      expect(result.moodScore).toBeCloseTo(1 / 3, 5);
    });

    describe("when a rubric is provided", () => {
      it("should use rubric moods instead of slot moods", () => {
        const s = makeSlot({ preferredMoods: [TrackMood.Peaceful] });
        const rubric = makeRubric({
          phases: {
            [ArcPhase.Rising]: {
              preferredMoods: [TrackMood.Epic],
              preferredInstrumentation: [],
              preferredRoles: [],
            },
          },
        });
        const result = scoreTrack(
          makeTrack({ energy: 2, moods: [TrackMood.Epic] }),
          s,
          rubric,
          null,
        )!;
        expect(result.moodScore).toBe(1.0);
      });
    });
  });

  describe("when computing instScore", () => {
    it("should use Jaccard of track instrumentation vs slot preferences", () => {
      const s = makeSlot({ preferredInstrumentation: [TrackInstrumentation.Piano] });
      const result = scoreTrack(
        makeTrack({
          energy: 2,
          instrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
        }),
        s,
        undefined,
        null,
      )!;
      expect(result.instScore).toBeCloseTo(0.5, 5);
    });
  });

  describe("when computing viewBiasScore", () => {
    describe("when viewBiasScores is null", () => {
      it("should use baseline", () => {
        const result = scoreTrack(makeTrack({ energy: 2 }), slot, undefined, null)!;
        expect(result.viewBiasScore).toBe(VIEW_BIAS_SCORE_BASELINE);
      });
    });

    describe("when viewBiasScores is provided", () => {
      it("should use the map value", () => {
        const result = scoreTrack(
          makeTrack({ energy: 2, videoId: "v1" }),
          slot,
          undefined,
          new Map([["v1", 0.8]]),
        )!;
        expect(result.viewBiasScore).toBe(0.8);
      });
    });
  });

  describe("when computing finalScore weights", () => {
    describe("when viewBiasScores is null", () => {
      it("should use standard weights", () => {
        const result = scoreTrack(makeTrack({ energy: 2 }), slot, undefined, null)!;
        const expected =
          result.roleScore * SCORE_WEIGHT_ROLE +
          result.moodScore * SCORE_WEIGHT_MOOD +
          result.instScore * SCORE_WEIGHT_INSTRUMENT;
        expect(result.finalScore).toBeCloseTo(expected, 10);
      });
    });

    describe("when viewBiasScores is provided", () => {
      it("should use view-bias weights", () => {
        const vbs = new Map([["v1", 0.7]]);
        const result = scoreTrack(makeTrack({ energy: 2, videoId: "v1" }), slot, undefined, vbs)!;
        const expected =
          result.roleScore * SCORE_WEIGHT_ROLE_VIEW_BIAS +
          result.moodScore * SCORE_WEIGHT_MOOD_VIEW_BIAS +
          result.viewBiasScore * SCORE_WEIGHT_VIEW_BIAS +
          result.instScore * SCORE_WEIGHT_INSTRUMENT_VIEW_BIAS;
        expect(result.finalScore).toBeCloseTo(expected, 10);
      });
    });
  });

  describe("when applying penalty multipliers", () => {
    describe("when track has a penalized mood from slot", () => {
      it("should apply SCORE_PENALTY_MULTIPLIER", () => {
        const result = scoreTrack(
          makeTrack({ energy: 2, moods: [TrackMood.Chaotic] }),
          slot,
          undefined,
          null,
        )!;
        expect(result.adjustedScore).toBeCloseTo(result.finalScore * SCORE_PENALTY_MULTIPLIER, 10);
      });
    });

    describe("when track has a penalized mood from rubric", () => {
      it("should apply SCORE_PENALTY_MULTIPLIER", () => {
        const s = makeSlot({ penalizedMoods: [TrackMood.Chaotic] });
        const rubric = makeRubric({ penalizedMoods: [TrackMood.Dark] });
        // penalizedMoods is global — no phase override needed
        const result = scoreTrack(
          makeTrack({ energy: 2, moods: [TrackMood.Dark] }),
          s,
          rubric,
          null,
        )!;
        expect(result.adjustedScore).toBeCloseTo(result.finalScore * SCORE_PENALTY_MULTIPLIER, 10);
      });
    });

    describe("when rubric disallows vocals and track has vocals", () => {
      it("should apply SCORE_VOCALS_PENALTY_MULTIPLIER", () => {
        const rubric = makeRubric({ allowVocals: false });
        const result = scoreTrack(makeTrack({ energy: 2, hasVocals: true }), slot, rubric, null)!;
        expect(result.adjustedScore).toBeCloseTo(
          result.finalScore * SCORE_VOCALS_PENALTY_MULTIPLIER,
          10,
        );
      });
    });

    describe("when both mood and vocals penalties apply", () => {
      it("should stack both multipliers", () => {
        const rubric = makeRubric({ allowVocals: false });
        const result = scoreTrack(
          makeTrack({ energy: 2, moods: [TrackMood.Chaotic], hasVocals: true }),
          slot,
          rubric,
          null,
        )!;
        expect(result.adjustedScore).toBeCloseTo(
          result.finalScore * SCORE_PENALTY_MULTIPLIER * SCORE_VOCALS_PENALTY_MULTIPLIER,
          10,
        );
      });
    });

    describe("when allowVocals is null", () => {
      it("should not apply vocals penalty", () => {
        const rubric = makeRubric({ allowVocals: null });
        const s = makeSlot({ penalizedMoods: [] });
        const result = scoreTrack(makeTrack({ energy: 2, hasVocals: true }), s, rubric, null)!;
        expect(result.adjustedScore).toBe(result.finalScore);
      });
    });

    describe("when track has no vocals and rubric disallows vocals", () => {
      it("should not apply vocals penalty", () => {
        const rubric = makeRubric({ allowVocals: false });
        const s = makeSlot({ penalizedMoods: [] });
        const result = scoreTrack(makeTrack({ energy: 2, hasVocals: false }), s, rubric, null)!;
        expect(result.adjustedScore).toBe(result.finalScore);
      });
    });
  });
});

// ─── weightedTopN ───────────────────────────────────────────────────────────

describe("weightedTopN", () => {
  describe("when candidates list is empty", () => {
    it("should return null", () => {
      expect(weightedTopN([])).toBeNull();
    });
  });

  describe("when there is a single candidate", () => {
    it("should return it", () => {
      const track = makeTrack();
      const result = weightedTopN([
        { track, breakdown: { ...ZERO_BREAKDOWN, adjustedScore: 0.5 } },
      ]);
      expect(result!.track).toBe(track);
    });
  });

  describe("when Math.random returns 0", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(0);
    });

    it("should select the top-scored candidate", () => {
      const candidates = [
        {
          track: makeTrack({ videoId: "low" }),
          breakdown: { ...ZERO_BREAKDOWN, adjustedScore: 0.1 },
        },
        {
          track: makeTrack({ videoId: "high" }),
          breakdown: { ...ZERO_BREAKDOWN, adjustedScore: 0.9 },
        },
        {
          track: makeTrack({ videoId: "mid" }),
          breakdown: { ...ZERO_BREAKDOWN, adjustedScore: 0.5 },
        },
      ];
      expect(weightedTopN(candidates)!.track.videoId).toBe("high");
    });

    it("should limit pool to DIRECTOR_TOP_N_POOL candidates", () => {
      const candidates = Array.from({ length: 10 }, (_, i) => ({
        track: makeTrack({ videoId: `v${i}` }),
        breakdown: { ...ZERO_BREAKDOWN, adjustedScore: (10 - i) / 10 },
      }));
      const result = weightedTopN(candidates)!;
      const topIds = candidates
        .sort((a, b) => b.breakdown.adjustedScore - a.breakdown.adjustedScore)
        .slice(0, DIRECTOR_TOP_N_POOL)
        .map((c) => c.track.videoId);
      expect(topIds).toContain(result.track.videoId);
    });
  });

  describe("when floating-point rounding prevents rand from reaching zero", () => {
    beforeEach(() => {
      vi.spyOn(Math, "random").mockReturnValue(1 - Number.EPSILON);
    });

    it("should still return a candidate (safety fallback)", () => {
      const candidates = [
        {
          track: makeTrack({ videoId: "a" }),
          breakdown: { ...ZERO_BREAKDOWN, adjustedScore: 0.001 },
        },
        {
          track: makeTrack({ videoId: "b" }),
          breakdown: { ...ZERO_BREAKDOWN, adjustedScore: 0.001 },
        },
      ];
      expect(weightedTopN(candidates)).not.toBeNull();
    });
  });
});

// ─── pickBestTrack ──────────────────────────────────────────────────────────

describe("pickBestTrack", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  describe("when track is already in used set", () => {
    it("should return null", () => {
      const result = pickBestTrack(
        [makeTrack({ energy: 2, videoId: "v1" })],
        makeSlot(),
        new Set(["v1"]),
        DEFAULT_GAME_ID,
        null,
        undefined,
        null,
      );
      expect(result).toBeNull();
    });
  });

  describe("when lastGameId matches the track's game (Pass 1)", () => {
    it("should prefer tracks from a different game", () => {
      const t1 = makeTrack({ energy: 2, videoId: "v1", gameId: DEFAULT_GAME_ID });
      const t2 = makeTrack({ energy: 2, videoId: "v2", gameId: "game-2" });
      const result = pickBestTrack(
        [t1, t2],
        makeSlot(),
        new Set(),
        DEFAULT_GAME_ID,
        DEFAULT_GAME_ID,
        undefined,
        null,
      );
      expect(result!.track.videoId).toBe("v2");
    });
  });

  describe("when only same-game tracks are available (Pass 2 fallback)", () => {
    it("should relax the same-game constraint", () => {
      const t1 = makeTrack({ energy: 2, videoId: "v1", gameId: DEFAULT_GAME_ID });
      const result = pickBestTrack(
        [t1],
        makeSlot(),
        new Set(),
        DEFAULT_GAME_ID,
        DEFAULT_GAME_ID,
        undefined,
        null,
      );
      expect(result!.track.videoId).toBe("v1");
    });
  });

  describe("when all tracks are used", () => {
    it("should return null", () => {
      const result = pickBestTrack(
        [makeTrack({ energy: 2, videoId: "v1" })],
        makeSlot(),
        new Set(["v1"]),
        DEFAULT_GAME_ID,
        null,
        undefined,
        null,
      );
      expect(result).toBeNull();
    });
  });

  describe("when no tracks match slot energy", () => {
    it("should return null", () => {
      const result = pickBestTrack(
        [makeTrack({ energy: 3 })],
        makeSlot({ energyPrefs: [1] }),
        new Set(),
        DEFAULT_GAME_ID,
        null,
        undefined,
        null,
      );
      expect(result).toBeNull();
    });
  });

  describe("when returning a result", () => {
    it("should include poolSize reflecting candidate count", () => {
      const tracks = Array.from({ length: 5 }, (_, i) =>
        makeTrack({ energy: 2, videoId: `v${i}` }),
      );
      expect(
        pickBestTrack(tracks, makeSlot(), new Set(), DEFAULT_GAME_ID, null, undefined, null)!
          .poolSize,
      ).toBe(5);
    });
  });
});

// ─── assemblePlaylist (integration) ─────────────────────────────────────────

describe("assemblePlaylist", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  function makePool(
    gameId: string,
    count: number,
    trackOverrides: Partial<TaggedTrack> = {},
  ): TaggedTrack[] {
    return Array.from({ length: count }, (_, i) =>
      makeTrack({
        videoId: `${gameId}-v${i}`,
        gameId,
        energy: ((i % 3) + 1) as 1 | 2 | 3,
        roles: [TrackRole.Ambient, TrackRole.Build, TrackRole.Combat],
        moods: [TrackMood.Peaceful, TrackMood.Epic],
        ...trackOverrides,
      }),
    );
  }

  describe("when pool is sufficient for target", () => {
    it("should return exactly targetCount tracks", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 20)]]),
        [makeGame({ id: "g1" })],
        10,
        undefined,
        false,
      );
      expect(result.tracks).toHaveLength(10);
    });
  });

  describe("when pool is smaller than target", () => {
    it("should return fewer tracks", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 3)]]),
        [makeGame({ id: "g1" })],
        50,
        undefined,
        false,
      );
      expect(result.tracks.length).toBeLessThanOrEqual(3);
    });
  });

  describe("when checking output uniqueness", () => {
    it("should produce no duplicate videoIds", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 30)]]),
        [makeGame({ id: "g1" })],
        20,
        undefined,
        false,
      );
      const videoIds = result.tracks.map((t) => t.videoId);
      expect(new Set(videoIds).size).toBe(videoIds.length);
    });
  });

  describe("when checking decision telemetry", () => {
    it("should populate one decision per track", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 20)]]),
        [makeGame({ id: "g1" })],
        10,
        undefined,
        false,
      );
      expect(result.decisions.length).toBe(result.tracks.length);
    });

    it("should produce contiguous positions starting from 0", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 20)]]),
        [makeGame({ id: "g1" })],
        10,
        undefined,
        false,
      );
      const positions = result.decisions.map((d) => d.position).sort((a, b) => a - b);
      for (let i = 0; i < positions.length; i++) {
        expect(positions[i]).toBe(i);
      }
    });
  });

  describe("when checking result metadata", () => {
    it("should populate gameBudgets", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 20)]]),
        [makeGame({ id: "g1" })],
        10,
        undefined,
        false,
      );
      expect(result.gameBudgets).toHaveProperty("g1");
    });

    it("should include rubric when provided", () => {
      const rubric = makeRubric({
        phases: {
          [ArcPhase.Intro]: {
            preferredMoods: [TrackMood.Epic],
            preferredInstrumentation: [],
            preferredRoles: [],
          },
        },
      });
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 10)]]),
        [makeGame({ id: "g1" })],
        5,
        rubric,
        false,
      );
      expect(result.rubric).toBe(rubric);
    });
  });

  describe("when a Focus game is present", () => {
    it("should give it more tracks than a normal game", () => {
      const result = assemblePlaylist(
        new Map([
          ["g-focus", makePool("g-focus", 20)],
          ["g-normal", makePool("g-normal", 20)],
        ]),
        [makeGame({ id: "g-focus", curation: CurationMode.Focus }), makeGame({ id: "g-normal" })],
        15,
        undefined,
        false,
      );
      const focusCount = result.tracks.filter((t) => t.gameId === "g-focus").length;
      const normalCount = result.tracks.filter((t) => t.gameId === "g-normal").length;
      expect(focusCount).toBeGreaterThan(normalCount);
    });
  });

  describe("when useViewBias is true", () => {
    it("should mark all decisions as viewBiasActive", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 10, { viewCount: 100_000 })]]),
        [makeGame({ id: "g1" })],
        5,
        undefined,
        true,
      );
      expect(result.decisions.every((d) => d.viewBiasActive)).toBe(true);
    });
  });

  describe("when pools are empty", () => {
    it("should return zero tracks", () => {
      const result = assemblePlaylist(
        new Map<string, TaggedTrack[]>([["g1", []]]),
        [makeGame({ id: "g1" })],
        10,
        undefined,
        false,
      );
      expect(result.tracks).toHaveLength(0);
    });
  });

  describe("when games have mixed curations", () => {
    it("should weight Focus > Lite", () => {
      const result = assemblePlaylist(
        new Map([
          ["g1", makePool("g1", 15)],
          ["g2", makePool("g2", 15)],
          ["g3", makePool("g3", 15)],
        ]),
        [
          makeGame({ id: "g1" }),
          makeGame({ id: "g2", curation: CurationMode.Lite }),
          makeGame({ id: "g3", curation: CurationMode.Focus }),
        ],
        20,
        undefined,
        false,
      );
      expect(result.tracks.filter((t) => t.gameId === "g3").length).toBeGreaterThanOrEqual(
        result.tracks.filter((t) => t.gameId === "g2").length,
      );
    });
  });

  describe("when primary games are budget-exhausted (over-budget fallback)", () => {
    it("should fill most slots via fallback", () => {
      const result = assemblePlaylist(
        new Map([
          ["g-small", makePool("g-small", 2)],
          ["g-focus", makePool("g-focus", 20)],
        ]),
        [makeGame({ id: "g-small" }), makeGame({ id: "g-focus", curation: CurationMode.Focus })],
        15,
        undefined,
        false,
      );
      expect(result.tracks.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("when all tracks have mismatched energy (last resort)", () => {
    it("should use LastResort selection pass", () => {
      const result = assemblePlaylist(
        new Map([["g1", makePool("g1", 15, { energy: 1 })]]),
        [makeGame({ id: "g1" })],
        10,
        undefined,
        false,
      );
      const lastResort = result.decisions.filter(
        (d) => d.selectionPass === SelectionPass.LastResort,
      );
      expect(lastResort.length).toBeGreaterThanOrEqual(1);
    });
  });
});
