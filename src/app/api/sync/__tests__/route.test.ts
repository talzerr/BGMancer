import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import type { DrizzleDB } from "@/lib/db";
import { createTestDrizzleDB, seedTestGame, seedTestUser } from "@/lib/db/test-helpers";
import { makeJsonRequest, parseJson } from "@/test/route-helpers";
import { TEST_USER_ID } from "@/test/constants";
import { PlaylistMode } from "@/types";
import type * as YouTubeModule from "@/lib/services/external/youtube";

// ─── Env gate + dev guard ────────────────────────────────────────────────────

let mockYoutubeSyncEnabled = true;
let mockIsDev = false;

vi.mock("@/lib/env", () => ({
  env: new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "youtubeSyncEnabled") return mockYoutubeSyncEnabled;
        if (prop === "isDev") return mockIsDev;
        return undefined;
      },
    },
  ),
}));

// ─── Auth (OAuth session) ────────────────────────────────────────────────────

type MockSession = {
  user?: { id: string } | null;
  access_token?: string;
  error?: string;
};
let mockSession: MockSession | null = null;

vi.mock("@/lib/services/auth/auth", () => ({
  auth: vi.fn(async () => mockSession),
}));

// ─── DB ──────────────────────────────────────────────────────────────────────

let db: DrizzleDB;
let rawDb: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    batch: async (queries: any[]) => db.batch(queries as [any]),
    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

// ─── Rate limit + YouTube client ─────────────────────────────────────────────

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: () => "1.2.3.4",
}));

vi.mock("@/lib/services/external/youtube", async () => {
  const actual = await vi.importActual<typeof YouTubeModule>("@/lib/services/external/youtube");
  return {
    ...actual,
    createYoutubePlaylist: vi.fn(),
    addVideoToPlaylist: vi.fn(),
  };
});

const { checkRateLimit } = await import("@/lib/rate-limit");
const { createYoutubePlaylist, addVideoToPlaylist, YouTubeOAuthError } =
  await import("@/lib/services/external/youtube");
const { Sessions, Playlist } = await import("@/lib/db/repo");
const { POST } = await import("../route");

// ─── Helpers ─────────────────────────────────────────────────────────────────

let seededUser = false;
function ensureUserAndGame(): string {
  if (!seededUser) {
    seedTestUser(rawDb);
    seededUser = true;
  }
  return seedTestGame(rawDb, TEST_USER_ID, { id: `game-${Math.random().toString(36).slice(2)}` });
}

async function createSessionWithTracks(opts: { videoIds: Array<string | null> }) {
  const gameId = ensureUserAndGame();
  const session = await Sessions.create(TEST_USER_ID, "Test session", PlaylistMode.Journey);
  await Playlist.replaceAll(
    session.id,
    opts.videoIds.map((videoId, i) => ({
      id: `track-${i}`,
      game_id: gameId,
      track_name: `Track ${i}`,
      video_id: videoId,
      video_title: null,
      channel_title: null,
      thumbnail: null,
      duration_seconds: 120,
    })),
  );
  return session;
}

beforeEach(() => {
  ({ db, rawDb } = createTestDrizzleDB());
  seededUser = false;
  mockYoutubeSyncEnabled = true;
  mockIsDev = false;
  mockSession = {
    user: { id: TEST_USER_ID },
    access_token: "oauth-token",
  };
  vi.mocked(checkRateLimit).mockReset();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true });
  vi.mocked(createYoutubePlaylist).mockReset();
  vi.mocked(addVideoToPlaylist).mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/sync", () => {
  describe("when the feature gate is disabled", () => {
    it("returns 503 before touching auth or DB", async () => {
      mockYoutubeSyncEnabled = false;
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: "anything" }));
      expect(res.status).toBe(503);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Feature not yet available");
      expect(createYoutubePlaylist).not.toHaveBeenCalled();
    });
  });

  describe("when running in dev mode", () => {
    it("returns 400 with a clear dev-only message", async () => {
      mockIsDev = true;
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: "s" }));
      expect(res.status).toBe(400);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Sync is not available in development.");
    });
  });

  describe("when the user is unauthenticated", () => {
    it("returns 401 when session is missing", async () => {
      mockSession = null;
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: "s" }));
      expect(res.status).toBe(401);
    });

    it("returns 401 when access_token is missing", async () => {
      mockSession = { user: { id: TEST_USER_ID } };
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: "s" }));
      expect(res.status).toBe(401);
    });

    it("returns 401 when session.error marks a refresh failure", async () => {
      mockSession = {
        user: { id: TEST_USER_ID },
        access_token: "stale",
        error: "RefreshAccessTokenError",
      };
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: "s" }));
      expect(res.status).toBe(401);
    });
  });

  describe("when the input body is invalid", () => {
    it("returns 400 for a missing sessionId", async () => {
      const res = await POST(makeJsonRequest("/api/sync", "POST", {}));
      expect(res.status).toBe(400);
    });

    it("returns 400 for a non-JSON body", async () => {
      // Zero body via makeJsonRequest("...", "POST") yields undefined → our
      // safeParse rejects it and we land on the validation branch.
      const res = await POST(makeJsonRequest("/api/sync", "POST"));
      expect(res.status).toBe(400);
    });
  });

  describe("when the session does not exist", () => {
    it("returns 404 without leaking existence", async () => {
      seedTestUser(rawDb);
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: "does-not-exist" }));
      expect(res.status).toBe(404);
    });
  });

  describe("when the session belongs to a different user", () => {
    it("returns 404 (same shape as not-found)", async () => {
      seedTestUser(rawDb);
      seedTestUser(rawDb, "other-user");
      const session = await Sessions.create("other-user", "Someone else's", PlaylistMode.Journey);
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(404);
    });
  });

  describe("when the session has no syncable tracks", () => {
    it("returns 400 with a specific message", async () => {
      const session = await createSessionWithTracks({ videoIds: [null, null] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(400);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("This session has no tracks with YouTube videos yet.");
      expect(createYoutubePlaylist).not.toHaveBeenCalled();
    });
  });

  describe("when rate-limited", () => {
    it("returns 429 and does not call the YouTube API", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });
      const session = await createSessionWithTracks({ videoIds: ["v1", "v2"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(429);
      expect(createYoutubePlaylist).not.toHaveBeenCalled();
    });
  });

  describe("when the sync succeeds", () => {
    it("creates the playlist, persists the ID, inserts all tracks, and returns 200", async () => {
      vi.mocked(createYoutubePlaylist).mockResolvedValue("PL_yt_123");
      vi.mocked(addVideoToPlaylist).mockResolvedValue("item-1");

      const session = await createSessionWithTracks({ videoIds: ["v1", null, "v2"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));

      expect(res.status).toBe(200);
      const body = await parseJson<{
        playlistId: string;
        playlistUrl: string;
        inserted: number;
        failed: number;
      }>(res);
      expect(body.playlistId).toBe("PL_yt_123");
      expect(body.playlistUrl).toBe("https://www.youtube.com/playlist?list=PL_yt_123");
      expect(body.inserted).toBe(2);
      expect(body.failed).toBe(0);

      // Persisted on the session row.
      const reloaded = await Sessions.getById(session.id);
      expect(reloaded!.youtube_playlist_id).toBe("PL_yt_123");

      // Title is prefixed with "BGMancer: ".
      expect(createYoutubePlaylist).toHaveBeenCalledWith(
        "oauth-token",
        expect.objectContaining({
          title: `BGMancer: ${session.name}`,
          privacy: "unlisted",
        }),
      );

      // All syncable tracks were inserted with explicit positions.
      expect(addVideoToPlaylist).toHaveBeenCalledTimes(2);
    });
  });

  describe("when some playlistItems.insert calls fail", () => {
    it("still returns 200 with failed count and keeps the playlist ID persisted", async () => {
      vi.mocked(createYoutubePlaylist).mockResolvedValue("PL_partial");
      vi.mocked(addVideoToPlaylist)
        .mockResolvedValueOnce("item-0")
        .mockRejectedValueOnce(new Error("transient"))
        .mockResolvedValueOnce("item-2");

      const session = await createSessionWithTracks({
        videoIds: ["v0", "v1", "v2"],
      });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));

      expect(res.status).toBe(200);
      const body = await parseJson<{ inserted: number; failed: number }>(res);
      expect(body.failed).toBe(1);
      expect(body.inserted).toBe(2);

      const reloaded = await Sessions.getById(session.id);
      expect(reloaded!.youtube_playlist_id).toBe("PL_partial");
    });
  });

  describe("YouTube error mapping", () => {
    it("maps 401 to a 401 re-auth error", async () => {
      vi.mocked(createYoutubePlaylist).mockRejectedValue(
        new YouTubeOAuthError(401, "authError", "body"),
      );
      const session = await createSessionWithTracks({ videoIds: ["v"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(401);
    });

    it("maps 403 insufficientPermissions to 401 re-auth", async () => {
      vi.mocked(createYoutubePlaylist).mockRejectedValue(
        new YouTubeOAuthError(403, "insufficientPermissions", "body"),
      );
      const session = await createSessionWithTracks({ videoIds: ["v"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(401);
    });

    it("maps 403 youtubeSignupRequired to 400", async () => {
      vi.mocked(createYoutubePlaylist).mockRejectedValue(
        new YouTubeOAuthError(403, "youtubeSignupRequired", "body"),
      );
      const session = await createSessionWithTracks({ videoIds: ["v"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(400);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Enable YouTube on your Google account to sync.");
    });

    it("maps 403 quotaExceeded to 503", async () => {
      vi.mocked(createYoutubePlaylist).mockRejectedValue(
        new YouTubeOAuthError(403, "quotaExceeded", "body"),
      );
      const session = await createSessionWithTracks({ videoIds: ["v"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(503);
    });

    it("maps 403 with an unknown reason to a masked 500", async () => {
      vi.mocked(createYoutubePlaylist).mockRejectedValue(
        new YouTubeOAuthError(403, "somethingElse", "body"),
      );
      const session = await createSessionWithTracks({ videoIds: ["v"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(500);
    });

    it("maps a generic thrown error to a masked 500", async () => {
      vi.mocked(createYoutubePlaylist).mockRejectedValue(new Error("oops"));
      const session = await createSessionWithTracks({ videoIds: ["v"] });
      const res = await POST(makeJsonRequest("/api/sync", "POST", { sessionId: session.id }));
      expect(res.status).toBe(500);
      const body = await parseJson<{ error: string }>(res);
      expect(body.error).toBe("Couldn't create playlist. Try again.");
    });
  });
});
