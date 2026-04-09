import { describe, it, expect, vi } from "vitest";
import { generateSessionName } from "../session-naming";
import {
  parseSessionName,
  buildSessionNamingUserPrompt,
  SESSION_NAMING_SYSTEM_PROMPT,
} from "@/lib/prompts/session-naming";
import type { LLMProvider } from "@/lib/llm/provider";
import { CurationMode, OnboardingPhase } from "@/types";
import type { Game } from "@/types";
import { SESSION_NAME_MAX_LENGTH } from "@/lib/constants";

function makeGame(title: string, curation = CurationMode.Include): Game {
  return {
    id: `game-${title.toLowerCase().replace(/\s+/g, "-")}`,
    title,
    curation,
    steam_appid: null,
    onboarding_phase: OnboardingPhase.Tagged,
    published: true,
    tracklist_source: null,
    yt_playlist_id: null,
    thumbnail_url: null,
    needs_review: false,
    created_at: "2026-04-06T00:00:00Z",
    updated_at: "2026-04-06T00:00:00Z",
  };
}

function mockProvider(response: string): LLMProvider {
  return { complete: vi.fn().mockResolvedValue(response) };
}

function failingProvider(err: Error): LLMProvider {
  return { complete: vi.fn().mockRejectedValue(err) };
}

describe("parseSessionName", () => {
  it("returns trimmed name for typical input", () => {
    expect(parseSessionName("  Boss Room Haze  ")).toBe("Boss Room Haze");
  });

  it("returns null for empty string", () => {
    expect(parseSessionName("")).toBeNull();
    expect(parseSessionName("    ")).toBeNull();
  });

  it("returns null when over SESSION_NAME_MAX_LENGTH", () => {
    expect(parseSessionName("A".repeat(SESSION_NAME_MAX_LENGTH + 1))).toBeNull();
  });

  it("strips surrounding double quotes", () => {
    expect(parseSessionName('"Neon Save Point"')).toBe("Neon Save Point");
  });

  it("strips surrounding single quotes", () => {
    expect(parseSessionName("'Pixel Fog'")).toBe("Pixel Fog");
  });

  it("strips curly quotes", () => {
    expect(parseSessionName("“Overworld Dust”")).toBe("Overworld Dust");
  });

  it("drops a trailing period", () => {
    expect(parseSessionName("Cartridge Bonfire.")).toBe("Cartridge Bonfire");
  });

  it("returns null when content is only quotes", () => {
    expect(parseSessionName('""')).toBeNull();
  });
});

describe("buildSessionNamingUserPrompt", () => {
  it("formats game list with curation tags", () => {
    const out = buildSessionNamingUserPrompt([
      { title: "Celeste", curation: CurationMode.Focus },
      { title: "Hollow Knight", curation: CurationMode.Include },
      { title: "Stardew Valley", curation: CurationMode.Lite },
    ]);
    expect(out).toContain("- Celeste [focus]");
    expect(out).toContain("- Hollow Knight [include]");
    expect(out).toContain("- Stardew Valley [lite]");
  });

  it("handles empty list", () => {
    expect(buildSessionNamingUserPrompt([])).toBe("No games.");
  });
});

describe("SESSION_NAMING_SYSTEM_PROMPT", () => {
  it("is a non-trivial string", () => {
    expect(SESSION_NAMING_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });
});

describe("generateSessionName", () => {
  it("returns null for empty games list and skips LLM call", async () => {
    const provider = mockProvider("Pixel Fog");
    const result = await generateSessionName([], provider);
    expect(result).toBeNull();
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("returns the parsed name on happy path", async () => {
    const provider = mockProvider("Boss Room Haze");
    const result = await generateSessionName(
      [makeGame("Dark Souls", CurationMode.Focus)],
      provider,
    );
    expect(result).toBe("Boss Room Haze");
    expect(provider.complete).toHaveBeenCalledTimes(1);
  });

  it("trims whitespace from the LLM response", async () => {
    const provider = mockProvider("   Neon Save Point   ");
    const result = await generateSessionName([makeGame("VA-11 Hall-A")], provider);
    expect(result).toBe("Neon Save Point");
  });

  it("returns null when the LLM response is empty", async () => {
    const provider = mockProvider("   ");
    const result = await generateSessionName([makeGame("Celeste")], provider);
    expect(result).toBeNull();
  });

  it("returns null when the LLM response is too long", async () => {
    const provider = mockProvider("A".repeat(SESSION_NAME_MAX_LENGTH + 1));
    const result = await generateSessionName([makeGame("Celeste")], provider);
    expect(result).toBeNull();
  });

  it("returns null when the LLM call throws", async () => {
    const provider = failingProvider(new Error("API down"));
    const result = await generateSessionName([makeGame("Celeste")], provider);
    expect(result).toBeNull();
  });

  it("passes curation modes into the user prompt", async () => {
    const provider = mockProvider("Campfire Loop");
    await generateSessionName(
      [makeGame("Celeste", CurationMode.Focus), makeGame("Stardew Valley", CurationMode.Lite)],
      provider,
    );
    const call = (provider.complete as ReturnType<typeof vi.fn>).mock.calls[0];
    const userPrompt = call[1] as string;
    expect(userPrompt).toContain("Celeste [focus]");
    expect(userPrompt).toContain("Stardew Valley [lite]");
  });
});
