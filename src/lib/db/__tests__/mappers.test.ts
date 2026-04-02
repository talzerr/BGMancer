import { describe, it, expect } from "vitest";
import {
  toUser,
  toPlaylistSession,
  toGame,
  toGames,
  toTrack,
  toTracks,
  toPlaylistTrack,
  toPlaylistTracks,
  parseJsonArray,
  VALID_CURATIONS,
} from "../mappers";
import {
  CurationMode,
  OnboardingPhase,
  TrackMood,
  TrackInstrumentation,
  TrackRole,
  DiscoveredStatus,
} from "@/types";

// ─── toUser ─────────────────────────────────────────────────────────────────

describe("toUser", () => {
  describe("when given a complete row", () => {
    it("should map all fields", () => {
      const user = toUser({
        id: "u1",
        email: "test@example.com",
        username: "alice",
        created_at: "2025-01-01",
      });
      expect(user).toEqual({
        id: "u1",
        email: "test@example.com",
        username: "alice",
        created_at: "2025-01-01",
      });
    });
  });

  describe("when username is null", () => {
    it("should preserve null", () => {
      const user = toUser({ id: "u1", email: "a@b.com", username: null, created_at: "2025-01-01" });
      expect(user.username).toBeNull();
    });
  });

  describe("when created_at is missing or null", () => {
    it("should default to empty string when undefined", () => {
      expect(toUser({ id: "u1", email: "a@b.com", username: null }).created_at).toBe("");
    });

    it("should default to empty string when null", () => {
      expect(
        toUser({ id: "u1", email: "a@b.com", username: null, created_at: null }).created_at,
      ).toBe("");
    });
  });
});

// ─── toPlaylistSession ──────────────────────────────────────────────────────

describe("toPlaylistSession", () => {
  const baseRow = {
    id: "s1",
    user_id: "u1",
    name: "Session 1",
    description: "A description",
    is_archived: 1,
    created_at: "2025-01-01",
  };

  describe("when given a complete row", () => {
    it("should map all fields", () => {
      expect(toPlaylistSession(baseRow)).toEqual({
        id: "s1",
        user_id: "u1",
        name: "Session 1",
        description: "A description",
        is_archived: true,
        created_at: "2025-01-01",
      });
    });
  });

  describe("when is_archived is 0", () => {
    it("should coerce to false", () => {
      expect(toPlaylistSession({ ...baseRow, is_archived: 0 }).is_archived).toBe(false);
    });
  });

  describe("when description is null", () => {
    it("should preserve null", () => {
      expect(toPlaylistSession({ ...baseRow, description: null }).description).toBeNull();
    });
  });

  describe("when created_at is null", () => {
    it("should default to empty string", () => {
      expect(toPlaylistSession({ ...baseRow, created_at: null }).created_at).toBe("");
    });
  });
});

// ─── toGame ─────────────────────────────────────────────────────────────────

describe("toGame", () => {
  const baseRow = {
    id: "g1",
    title: "Dark Souls",
    curation: CurationMode.Include,
    steam_appid: 570940,
    onboarding_phase: OnboardingPhase.Tagged,
    published: 1,
    tracklist_source: "discogs",
    yt_playlist_id: "PLabc",
    thumbnail_url: "https://example.com/thumb.jpg",
    needs_review: 0,
    created_at: "2025-01-01",
    updated_at: "2025-01-02",
  };

  describe("when given a fully populated row", () => {
    it("should map all fields", () => {
      const game = toGame(baseRow);
      expect(game.id).toBe("g1");
      expect(game.title).toBe("Dark Souls");
      expect(game.curation).toBe(CurationMode.Include);
      expect(game.steam_appid).toBe(570940);
      expect(game.onboarding_phase).toBe(OnboardingPhase.Tagged);
      expect(game.published).toBe(true);
    });

    it("should accept all valid curation modes", () => {
      for (const mode of VALID_CURATIONS) {
        expect(toGame({ ...baseRow, curation: mode }).curation).toBe(mode);
      }
    });
  });

  describe("when curation is invalid or missing", () => {
    it("should default to Include for unrecognized value", () => {
      expect(toGame({ ...baseRow, curation: "bogus" }).curation).toBe(CurationMode.Include);
    });

    it("should default to Include when undefined", () => {
      expect(toGame({ ...baseRow, curation: undefined }).curation).toBe(CurationMode.Include);
    });
  });

  describe("when onboarding_phase is invalid", () => {
    it("should default to Draft", () => {
      expect(toGame({ ...baseRow, onboarding_phase: "invalid" }).onboarding_phase).toBe(
        OnboardingPhase.Draft,
      );
    });
  });

  describe("when nullable fields are null", () => {
    it("should preserve null", () => {
      const game = toGame({
        ...baseRow,
        steam_appid: null,
        tracklist_source: null,
        yt_playlist_id: null,
        thumbnail_url: null,
      });
      expect(game.steam_appid).toBeNull();
      expect(game.tracklist_source).toBeNull();
      expect(game.yt_playlist_id).toBeNull();
      expect(game.thumbnail_url).toBeNull();
    });
  });

  describe("when coercing boolean fields", () => {
    it("should coerce published=0 to false and needs_review=1 to true", () => {
      const game = toGame({ ...baseRow, published: 0, needs_review: 1 });
      expect(game.published).toBe(false);
      expect(game.needs_review).toBe(true);
    });
  });

  describe("when timestamp fields are null", () => {
    it("should default to empty strings", () => {
      const game = toGame({ ...baseRow, created_at: null, updated_at: null });
      expect(game.created_at).toBe("");
      expect(game.updated_at).toBe("");
    });
  });
});

describe("toGames", () => {
  it("should map each row through toGame", () => {
    const games = toGames([
      { id: "g1", title: "A", curation: CurationMode.Include, created_at: "", updated_at: "" },
      { id: "g2", title: "B", curation: CurationMode.Focus, created_at: "", updated_at: "" },
    ]);
    expect(games).toHaveLength(2);
    expect(games[0].id).toBe("g1");
    expect(games[1].id).toBe("g2");
  });
});

// ─── parseJsonArray ─────────────────────────────────────────────────────────

describe("parseJsonArray", () => {
  const validSet = new Set(["a", "b", "c"]);

  describe("when input is null or undefined", () => {
    it("should return empty array", () => {
      expect(parseJsonArray(null, validSet)).toEqual([]);
      expect(parseJsonArray(undefined, validSet)).toEqual([]);
    });
  });

  describe("when input is an existing array", () => {
    it("should filter against the valid set", () => {
      expect(parseJsonArray(["a", "b", "z"], validSet)).toEqual(["a", "b"]);
    });

    it("should filter out non-string items", () => {
      expect(parseJsonArray([1, "a", null, "b"], validSet)).toEqual(["a", "b"]);
    });
  });

  describe("when input is a JSON string", () => {
    it("should parse and filter valid values", () => {
      expect(parseJsonArray('["a","c","invalid"]', validSet)).toEqual(["a", "c"]);
    });

    it("should return empty array for malformed JSON", () => {
      expect(parseJsonArray("{not json}", validSet)).toEqual([]);
    });

    it("should return empty array for non-array JSON", () => {
      expect(parseJsonArray('"just a string"', validSet)).toEqual([]);
    });
  });

  describe("when input is an unsupported type", () => {
    it("should return empty array", () => {
      expect(parseJsonArray(42, validSet)).toEqual([]);
    });
  });
});

// ─── toTrack ────────────────────────────────────────────────────────────────

describe("toTrack", () => {
  const baseRow = {
    game_id: "g1",
    name: "Title Screen",
    position: 1,
    duration_seconds: 180,
    energy: 2,
    roles: JSON.stringify([TrackRole.Opener]),
    moods: JSON.stringify([TrackMood.Peaceful, TrackMood.Nostalgic]),
    instrumentation: JSON.stringify([TrackInstrumentation.Piano]),
    has_vocals: 0,
    active: 1,
    discovered: DiscoveredStatus.Approved,
    tagged_at: "2025-01-01",
  };

  describe("when given a fully populated row", () => {
    it("should map all fields", () => {
      const track = toTrack(baseRow);
      expect(track.gameId).toBe("g1");
      expect(track.name).toBe("Title Screen");
      expect(track.position).toBe(1);
      expect(track.durationSeconds).toBe(180);
      expect(track.energy).toBe(2);
      expect(track.roles).toEqual([TrackRole.Opener]);
      expect(track.moods).toEqual([TrackMood.Peaceful, TrackMood.Nostalgic]);
      expect(track.instrumentation).toEqual([TrackInstrumentation.Piano]);
      expect(track.hasVocals).toBe(false);
      expect(track.active).toBe(true);
      expect(track.discovered).toBe(DiscoveredStatus.Approved);
      expect(track.taggedAt).toBe("2025-01-01");
    });
  });

  describe("when energy is valid", () => {
    it("should accept 1, 2, and 3", () => {
      expect(toTrack({ ...baseRow, energy: 1 }).energy).toBe(1);
      expect(toTrack({ ...baseRow, energy: 2 }).energy).toBe(2);
      expect(toTrack({ ...baseRow, energy: 3 }).energy).toBe(3);
    });
  });

  describe("when energy is out of range or non-numeric", () => {
    it("should return null", () => {
      expect(toTrack({ ...baseRow, energy: 0 }).energy).toBeNull();
      expect(toTrack({ ...baseRow, energy: 4 }).energy).toBeNull();
      expect(toTrack({ ...baseRow, energy: null }).energy).toBeNull();
      expect(toTrack({ ...baseRow, energy: "high" }).energy).toBeNull();
    });
  });

  describe("when JSON enum arrays contain invalid values", () => {
    it("should drop invalid roles", () => {
      expect(
        toTrack({ ...baseRow, roles: JSON.stringify(["opener", "invalid_role", "combat"]) }).roles,
      ).toEqual([TrackRole.Opener, TrackRole.Combat]);
    });

    it("should drop invalid moods", () => {
      expect(toTrack({ ...baseRow, moods: JSON.stringify(["epic", "fake_mood"]) }).moods).toEqual([
        TrackMood.Epic,
      ]);
    });

    it("should drop invalid instrumentation", () => {
      expect(
        toTrack({ ...baseRow, instrumentation: JSON.stringify(["piano", "kazoo"]) })
          .instrumentation,
      ).toEqual([TrackInstrumentation.Piano]);
    });
  });

  describe("when coercing boolean-like fields", () => {
    it("should coerce has_vocals correctly", () => {
      expect(toTrack({ ...baseRow, has_vocals: 1 }).hasVocals).toBe(true);
      expect(toTrack({ ...baseRow, has_vocals: 0 }).hasVocals).toBe(false);
      expect(toTrack({ ...baseRow, has_vocals: null }).hasVocals).toBeNull();
    });

    it("should coerce active correctly", () => {
      expect(toTrack({ ...baseRow, active: 0 }).active).toBe(false);
      expect(toTrack({ ...baseRow, active: 1 }).active).toBe(true);
    });
  });

  describe("when discovered status is null or invalid", () => {
    it("should return null for null", () => {
      expect(toTrack({ ...baseRow, discovered: null }).discovered).toBeNull();
    });

    it("should return null for unrecognized value", () => {
      expect(toTrack({ ...baseRow, discovered: "bogus" }).discovered).toBeNull();
    });
  });

  describe("when optional fields are null or missing", () => {
    it("should handle null tagged_at", () => {
      expect(toTrack({ ...baseRow, tagged_at: null }).taggedAt).toBeNull();
    });

    it("should handle null duration_seconds", () => {
      expect(toTrack({ ...baseRow, duration_seconds: null }).durationSeconds).toBeNull();
    });

    it("should default position to 0 when missing", () => {
      expect(toTrack({ ...baseRow, position: undefined }).position).toBe(0);
    });
  });
});

describe("toTracks", () => {
  it("should map each row through toTrack", () => {
    const tracks = toTracks([
      { game_id: "g1", name: "A", position: 0 },
      { game_id: "g2", name: "B", position: 1 },
    ]);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].name).toBe("A");
  });
});

// ─── toPlaylistTrack ────────────────────────────────────────────────────────

describe("toPlaylistTrack", () => {
  const baseRow = {
    id: "pt1",
    playlist_id: "pl1",
    game_id: "g1",
    game_title: "Dark Souls",
    track_name: "Firelink Shrine",
    video_id: "abc123",
    video_title: "Firelink Shrine - Dark Souls OST",
    channel_title: "GameOST",
    thumbnail: "https://i.ytimg.com/vi/abc123/default.jpg",
    duration_seconds: 240,
    position: 0,
    created_at: "2025-01-01",
    synced_at: null,
  };

  describe("when given a complete row", () => {
    it("should map all fields", () => {
      const pt = toPlaylistTrack(baseRow);
      expect(pt.id).toBe("pt1");
      expect(pt.playlist_id).toBe("pl1");
      expect(pt.game_id).toBe("g1");
      expect(pt.game_title).toBe("Dark Souls");
      expect(pt.track_name).toBe("Firelink Shrine");
      expect(pt.video_id).toBe("abc123");
    });
  });

  describe("when nullable fields are null", () => {
    it("should preserve null or undefined as appropriate", () => {
      const pt = toPlaylistTrack({
        ...baseRow,
        game_title: null,
        track_name: null,
        video_id: null,
        video_title: null,
        channel_title: null,
        thumbnail: null,
        duration_seconds: null,
        synced_at: null,
      });
      expect(pt.game_title).toBeUndefined();
      expect(pt.track_name).toBeNull();
      expect(pt.video_id).toBeNull();
      expect(pt.video_title).toBeNull();
      expect(pt.channel_title).toBeNull();
      expect(pt.thumbnail).toBeNull();
      expect(pt.duration_seconds).toBeNull();
      expect(pt.synced_at).toBeNull();
    });
  });

  describe("when nullable fields have values", () => {
    it("should map them correctly", () => {
      const pt = toPlaylistTrack({
        ...baseRow,
        synced_at: "2025-06-01",
        game_thumbnail_url: "https://cdn.steam.com/header.jpg",
      });
      expect(pt.synced_at).toBe("2025-06-01");
      expect(pt.game_thumbnail_url).toBe("https://cdn.steam.com/header.jpg");
    });
  });

  describe("when position or created_at are missing", () => {
    it("should default position to 0", () => {
      expect(toPlaylistTrack({ ...baseRow, position: undefined }).position).toBe(0);
    });

    it("should default created_at to empty string when null", () => {
      expect(toPlaylistTrack({ ...baseRow, created_at: null }).created_at).toBe("");
    });
  });
});

describe("toPlaylistTracks", () => {
  it("should map each row through toPlaylistTrack", () => {
    const tracks = toPlaylistTracks([
      { id: "pt1", game_id: "g1", position: 0 },
      { id: "pt2", game_id: "g2", position: 1 },
    ]);
    expect(tracks).toHaveLength(2);
    expect(tracks[0].id).toBe("pt1");
  });
});
