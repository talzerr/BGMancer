import { describe, it, expect, vi, afterEach } from "vitest";
import { generateRubric, buildGameProfiles, findCachedRubric } from "../vibe-profiler";
import type { GameProfile } from "../vibe-profiler";
import type { LLMProvider } from "@/lib/llm/provider";
import { ArcPhase, TrackMood, TrackInstrumentation, TrackRole } from "@/types";
import type { VibeRubric, PlaylistSession } from "@/types";
import { Sessions } from "@/lib/db/repo";
import type { SessionWithTelemetry } from "@/lib/db/repos/sessions";
import { TEST_GAME_TITLE } from "@/test/constants";

afterEach(() => {
  vi.restoreAllMocks();
});

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

describe("findCachedRubric", () => {
  const TEST_USER_ID = "user-1";

  function makeSession(id: string, name: string): PlaylistSession & { track_count: number } {
    return {
      id,
      user_id: TEST_USER_ID,
      name,
      description: null,
      is_archived: false,
      created_at: "2026-04-06T00:00:00Z",
      track_count: 10,
    };
  }

  function makeRubric(): VibeRubric {
    return {
      phases: {
        [ArcPhase.Intro]: {
          preferredMoods: [TrackMood.Peaceful, TrackMood.Mysterious],
          preferredInstrumentation: [TrackInstrumentation.Piano, TrackInstrumentation.Strings],
          preferredRoles: [TrackRole.Opener],
        },
      },
      penalizedMoods: [TrackMood.Playful],
      allowVocals: false,
    };
  }

  function makeTelemetry(
    id: string,
    name: string,
    rubric: VibeRubric | null,
    gameBudgets: Record<string, number> | null,
  ): SessionWithTelemetry {
    return {
      id,
      user_id: TEST_USER_ID,
      name,
      description: null,
      is_archived: false,
      created_at: "2026-04-06T00:00:00Z",
      rubric,
      gameBudgets,
    };
  }

  it("should return null when user has no sessions", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([]);
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result).toBeNull();
  });

  it("should return null when no session has a rubric", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([makeSession("s1", "Old Session")]);
    vi.spyOn(Sessions, "getByIdWithTelemetry").mockResolvedValue(
      makeTelemetry("s1", "Old Session", null, { g1: 5, g2: 5 }),
    );
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result).toBeNull();
  });

  it("should return null when session has rubric but no gameBudgets", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([makeSession("s1", "Old Session")]);
    vi.spyOn(Sessions, "getByIdWithTelemetry").mockResolvedValue(
      makeTelemetry("s1", "Old Session", makeRubric(), null),
    );
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result).toBeNull();
  });

  it("should skip sessions with different game set size", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([makeSession("s1", "Old Session")]);
    vi.spyOn(Sessions, "getByIdWithTelemetry").mockResolvedValue(
      makeTelemetry("s1", "Old Session", makeRubric(), { g1: 5, g2: 5 }),
    );
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2", "g3"]);
    expect(result).toBeNull();
  });

  it("should skip sessions with same size but different game IDs", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([makeSession("s1", "Old Session")]);
    vi.spyOn(Sessions, "getByIdWithTelemetry").mockResolvedValue(
      makeTelemetry("s1", "Old Session", makeRubric(), { g1: 5, g2: 5 }),
    );
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g3"]);
    expect(result).toBeNull();
  });

  it("should return rubric and sessionName on exact match", async () => {
    const rubric = makeRubric();
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([
      makeSession("s1", "Moonlit Descent"),
    ]);
    vi.spyOn(Sessions, "getByIdWithTelemetry").mockResolvedValue(
      makeTelemetry("s1", "Moonlit Descent", rubric, { g1: 5, g2: 5 }),
    );
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result).not.toBeNull();
    expect(result!.rubric).toBe(rubric);
    expect(result!.sessionName).toBe("Moonlit Descent");
  });

  it("should match regardless of game ID order", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([makeSession("s1", "Cached")]);
    vi.spyOn(Sessions, "getByIdWithTelemetry").mockResolvedValue(
      makeTelemetry("s1", "Cached", makeRubric(), { g2: 5, g1: 5 }),
    );
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result).not.toBeNull();
    expect(result!.sessionName).toBe("Cached");
  });

  it("should return the first matching session (newest-first)", async () => {
    const rubric1 = makeRubric();
    const rubric2 = makeRubric();
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([
      makeSession("s1", "Newest"),
      makeSession("s2", "Older"),
    ]);
    const spy = vi
      .spyOn(Sessions, "getByIdWithTelemetry")
      .mockResolvedValueOnce(makeTelemetry("s1", "Newest", rubric1, { g1: 5, g2: 5 }))
      .mockResolvedValueOnce(makeTelemetry("s2", "Older", rubric2, { g1: 5, g2: 5 }));
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result!.sessionName).toBe("Newest");
    expect(result!.rubric).toBe(rubric1);
    // Should short-circuit after finding the first match
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("should fall through to later sessions when the first doesn't match", async () => {
    vi.spyOn(Sessions, "listAllWithCounts").mockResolvedValue([
      makeSession("s1", "Different"),
      makeSession("s2", "Match"),
    ]);
    vi.spyOn(Sessions, "getByIdWithTelemetry")
      .mockResolvedValueOnce(makeTelemetry("s1", "Different", makeRubric(), { g3: 5, g4: 5 }))
      .mockResolvedValueOnce(makeTelemetry("s2", "Match", makeRubric(), { g1: 5, g2: 5 }));
    const result = await findCachedRubric(TEST_USER_ID, ["g1", "g2"]);
    expect(result).not.toBeNull();
    expect(result!.sessionName).toBe("Match");
  });
});
