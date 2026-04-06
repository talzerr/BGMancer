import { describe, it, expect, vi } from "vitest";
import { generateRubric, buildGameProfiles } from "../vibe-profiler";
import type { GameProfile } from "../vibe-profiler";
import type { LLMProvider } from "@/lib/llm/provider";
import { ArcPhase, TrackMood, TrackInstrumentation, TrackRole } from "@/types";
import { TEST_GAME_TITLE } from "@/test/constants";

function makeProfile(title = TEST_GAME_TITLE): GameProfile {
  return {
    title,
    trackCount: 10,
    energy: { "2": 5, "3": 3, "1": 2 },
    moods: { [TrackMood.Epic]: 4, [TrackMood.Mysterious]: 3, [TrackMood.Peaceful]: 3 },
    instrumentation: {
      [TrackInstrumentation.Orchestral]: 5,
      [TrackInstrumentation.Piano]: 3,
      [TrackInstrumentation.Strings]: 2,
    },
  };
}

function mockProvider(response: string): LLMProvider {
  return {
    complete: vi.fn().mockResolvedValue(response),
  };
}

function failingProvider(error: Error): LLMProvider {
  return {
    complete: vi.fn().mockRejectedValue(error),
  };
}

/** Minimal valid per-phase response with all 6 phases. */
function makeValidResponse(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    phases: {
      intro: {
        preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious],
        preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
        preferredRoles: [TrackRole.Opener],
      },
      rising: {
        preferredMoods: [TrackMood.Tense, TrackMood.Melancholic],
        preferredInstrumentation: [TrackInstrumentation.Orchestral, TrackInstrumentation.Synth],
        preferredRoles: [TrackRole.Build],
      },
      peak: {
        preferredMoods: [TrackMood.Epic, TrackMood.Heroic],
        preferredInstrumentation: [TrackInstrumentation.Orchestral, TrackInstrumentation.Rock],
        preferredRoles: [TrackRole.Combat],
      },
      valley: {
        preferredMoods: [TrackMood.Serene, TrackMood.Melancholic],
        preferredInstrumentation: [TrackInstrumentation.Ambient, TrackInstrumentation.Piano],
        preferredRoles: [],
      },
      climax: {
        preferredMoods: [TrackMood.Epic, TrackMood.Triumphant],
        preferredInstrumentation: [TrackInstrumentation.Metal, TrackInstrumentation.Choir],
        preferredRoles: [TrackRole.Combat, TrackRole.Cinematic],
      },
      outro: {
        preferredMoods: [TrackMood.Nostalgic, TrackMood.Peaceful],
        preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Acoustic],
        preferredRoles: [TrackRole.Closer],
      },
    },
    penalizedMoods: [TrackMood.Playful, TrackMood.Whimsical],
    allowVocals: false,
    sessionName: "Soulsborne Descent",
    ...overrides,
  });
}

describe("generateRubric", () => {
  describe("when game titles list is empty", () => {
    it("should return null without calling the provider", async () => {
      const provider = mockProvider("");
      const result = await generateRubric({ gameProfiles: [] }, provider);
      expect(result).toBeNull();
      expect(provider.complete).not.toHaveBeenCalled();
    });
  });

  describe("when the LLM returns a valid rubric", () => {
    it("should parse all phase overrides correctly", async () => {
      const provider = mockProvider(makeValidResponse());
      const result = await generateRubric({ gameProfiles: [makeProfile()] }, provider);

      expect(result).not.toBeNull();
      const rubric = result!.rubric;

      expect(Object.keys(rubric.phases)).toHaveLength(6);
      expect(rubric.phases.intro!.preferredMoods).toEqual([
        TrackMood.Peaceful,
        TrackMood.Mysterious,
      ]);
      expect(rubric.phases.peak!.preferredInstrumentation).toEqual([
        TrackInstrumentation.Orchestral,
        TrackInstrumentation.Rock,
      ]);
      expect(rubric.phases.climax!.preferredRoles).toEqual([TrackRole.Combat, TrackRole.Cinematic]);
      expect(rubric.phases.valley!.preferredRoles).toEqual([]);
    });

    it("should parse global fields correctly", async () => {
      const provider = mockProvider(makeValidResponse());
      const result = await generateRubric({ gameProfiles: [makeProfile()] }, provider);

      const rubric = result!.rubric;
      expect(rubric.penalizedMoods).toEqual([TrackMood.Playful, TrackMood.Whimsical]);
      expect(rubric.allowVocals).toBe(false);
      expect(result!.sessionName).toBe("Soulsborne Descent");
    });

    it("should pass cacheSystem: true to the provider", async () => {
      const provider = mockProvider(makeValidResponse());
      await generateRubric({ gameProfiles: [makeProfile()] }, provider);

      expect(provider.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ cacheSystem: true }),
      );
    });
  });

  describe("when the LLM response is wrapped in prose", () => {
    it("should extract the JSON object", async () => {
      const response = `Here's the rubric:\n${makeValidResponse()}\nDone!`;
      const provider = mockProvider(response);
      const result = await generateRubric(
        { gameProfiles: [makeProfile("Stardew Valley")] },
        provider,
      );
      expect(result).not.toBeNull();
      expect(result!.rubric.phases.intro!.preferredMoods).toContain(TrackMood.Peaceful);
    });
  });

  describe("when the LLM returns no JSON object", () => {
    it("should return null", async () => {
      const provider = mockProvider("I cannot produce a rubric for that.");
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("when the LLM returns malformed JSON", () => {
    it("should return null", async () => {
      const provider = mockProvider("{broken json here}}}");
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("when the LLM call throws an error", () => {
    it("should return null", async () => {
      const provider = failingProvider(new Error("API timeout"));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).toBeNull();
    });
  });

  describe("phase validation", () => {
    it("should drop phases with invalid moods", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: ["invalid_mood"],
              preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
              preferredRoles: [],
            },
            peak: {
              preferredMoods: [TrackMood.Epic, TrackMood.Heroic],
              preferredInstrumentation: [
                TrackInstrumentation.Orchestral,
                TrackInstrumentation.Rock,
              ],
              preferredRoles: [],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).not.toBeNull();
      expect(result!.rubric.phases.intro).toBeUndefined();
      expect(result!.rubric.phases.peak).toBeDefined();
    });

    it("should drop phases with invalid instrumentation", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious],
              preferredInstrumentation: ["invalid_inst"],
              preferredRoles: [],
            },
            peak: {
              preferredMoods: [TrackMood.Epic, TrackMood.Heroic],
              preferredInstrumentation: [
                TrackInstrumentation.Orchestral,
                TrackInstrumentation.Rock,
              ],
              preferredRoles: [],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).not.toBeNull();
      expect(result!.rubric.phases.intro).toBeUndefined();
      expect(result!.rubric.phases.peak).toBeDefined();
    });

    it("should return null when all phases are invalid", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: ["invalid"],
              preferredInstrumentation: [TrackInstrumentation.Piano],
              preferredRoles: [],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).toBeNull();
    });

    it("should return null when phases is missing", async () => {
      const provider = mockProvider(
        JSON.stringify({
          penalizedMoods: [TrackMood.Playful],
          allowVocals: null,
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).toBeNull();
    });

    it("should accept partial phases (not all 6 required)", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: [TrackMood.Dark, TrackMood.Mysterious],
              preferredInstrumentation: [
                TrackInstrumentation.Ambient,
                TrackInstrumentation.Strings,
              ],
              preferredRoles: [],
            },
            climax: {
              preferredMoods: [TrackMood.Epic, TrackMood.Chaotic],
              preferredInstrumentation: [TrackInstrumentation.Metal, TrackInstrumentation.Choir],
              preferredRoles: [TrackRole.Combat],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result).not.toBeNull();
      expect(Object.keys(result!.rubric.phases)).toHaveLength(2);
      expect(result!.rubric.phases.intro).toBeDefined();
      expect(result!.rubric.phases.climax).toBeDefined();
    });

    it("should truncate moods to 2 per phase", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious, TrackMood.Nostalgic],
              preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
              preferredRoles: [],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.rubric.phases.intro!.preferredMoods).toHaveLength(2);
    });

    it("should truncate instrumentation to 2 per phase", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious],
              preferredInstrumentation: [
                TrackInstrumentation.Piano,
                TrackInstrumentation.Strings,
                TrackInstrumentation.Ambient,
              ],
              preferredRoles: [],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.rubric.phases.intro!.preferredInstrumentation).toHaveLength(2);
    });

    it("should truncate roles to 2 per phase", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious],
              preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
              preferredRoles: [TrackRole.Opener, TrackRole.Menu, TrackRole.Ambient],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.rubric.phases.intro!.preferredRoles).toHaveLength(2);
    });

    it("should ignore unknown phase names", async () => {
      const provider = mockProvider(
        makeValidResponse({
          phases: {
            intro: {
              preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious],
              preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
              preferredRoles: [],
            },
            unknown_phase: {
              preferredMoods: [TrackMood.Epic],
              preferredInstrumentation: [TrackInstrumentation.Orchestral],
              preferredRoles: [],
            },
          },
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(Object.keys(result!.rubric.phases)).toHaveLength(1);
      expect(result!.rubric.phases[ArcPhase.Intro]).toBeDefined();
    });
  });

  describe("global fields", () => {
    it("should default allowVocals to null for non-boolean values", async () => {
      const provider = mockProvider(makeValidResponse({ allowVocals: "maybe" }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.rubric.allowVocals).toBeNull();
    });

    it("should truncate penalizedMoods to 3", async () => {
      const provider = mockProvider(
        makeValidResponse({
          penalizedMoods: [
            TrackMood.Playful,
            TrackMood.Whimsical,
            TrackMood.Chaotic,
            TrackMood.Serene,
          ],
        }),
      );
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.rubric.penalizedMoods).toHaveLength(3);
    });

    it("should handle missing penalizedMoods gracefully", async () => {
      const provider = mockProvider(makeValidResponse({ penalizedMoods: undefined }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.rubric.penalizedMoods).toEqual([]);
    });
  });

  describe("sessionName", () => {
    it("should return null when sessionName is missing", async () => {
      const provider = mockProvider(makeValidResponse({ sessionName: undefined }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.sessionName).toBeNull();
    });

    it("should return null when sessionName is not a string", async () => {
      const provider = mockProvider(makeValidResponse({ sessionName: 42 }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.sessionName).toBeNull();
    });

    it("should return null when sessionName is empty", async () => {
      const provider = mockProvider(makeValidResponse({ sessionName: "   " }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.sessionName).toBeNull();
    });

    it("should return null when sessionName exceeds max length", async () => {
      const provider = mockProvider(makeValidResponse({ sessionName: "A".repeat(101) }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.sessionName).toBeNull();
    });

    it("should trim whitespace from valid sessionName", async () => {
      const provider = mockProvider(makeValidResponse({ sessionName: "  Moonlit Kingdoms  " }));
      const result = await generateRubric({ gameProfiles: [makeProfile("Test")] }, provider);
      expect(result!.sessionName).toBe("Moonlit Kingdoms");
    });
  });
});

describe("buildGameProfiles", () => {
  it("should aggregate energy, moods, and instrumentation from tagged tracks", () => {
    const games = [{ id: "g1", title: "Dark Souls" }];
    const pools = new Map([
      [
        "g1",
        [
          {
            energy: 2 as const,
            moods: [TrackMood.Dark, TrackMood.Mysterious],
            instrumentation: [TrackInstrumentation.Orchestral],
          },
          {
            energy: 3 as const,
            moods: [TrackMood.Dark, TrackMood.Epic],
            instrumentation: [TrackInstrumentation.Orchestral, TrackInstrumentation.Choir],
          },
          {
            energy: 2 as const,
            moods: [TrackMood.Mysterious],
            instrumentation: [TrackInstrumentation.Strings],
          },
        ],
      ],
    ]);

    const profiles = buildGameProfiles(games, pools);
    expect(profiles).toHaveLength(1);
    const p = profiles[0];
    expect(p.title).toBe("Dark Souls");
    expect(p.trackCount).toBe(3);
    expect(p.energy).toEqual({ "2": 2, "3": 1 });
    expect(p.moods).toEqual({
      [TrackMood.Dark]: 2,
      [TrackMood.Mysterious]: 2,
      [TrackMood.Epic]: 1,
    });
    expect(p.instrumentation).toEqual({
      [TrackInstrumentation.Orchestral]: 2,
      [TrackInstrumentation.Choir]: 1,
      [TrackInstrumentation.Strings]: 1,
    });
  });

  it("should skip games with no tracks in the pool", () => {
    const games = [
      { id: "g1", title: "Game A" },
      { id: "g2", title: "Game B" },
    ];
    const pools = new Map([
      ["g1", [{ energy: 1 as const, moods: [TrackMood.Peaceful], instrumentation: [] }]],
    ]);

    const profiles = buildGameProfiles(games, pools);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].title).toBe("Game A");
  });
});
