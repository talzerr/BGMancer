// ─── Shared test constants ──────────────────────────────────────────────────
// Avoids magic strings scattered across test files.
// File-specific constants (e.g. a second game ID used only in one test)
// should be declared at the top of that test file instead.

// ─── Identity ───────────────────────────────────────────────────────────────

export const TEST_USER_ID = "test-user-1";
export const TEST_USER_EMAIL = "test-user-1@test.com";
export const TEST_USER_NAME = "TestUser";

/** Used in vi.mock("@/lib/db") across all DB integration tests */
export const MOCK_LOCAL_USER_ID = "local-user";
export const MOCK_LOCAL_LIBRARY_ID = "local-lib";

// ─── Games ──────────────────────────────────────────────────────────────────

export const TEST_GAME_ID = "g1";
export const TEST_GAME_TITLE = "Dark Souls";
export const TEST_STEAM_APPID = 570940;

// ─── Tracks ─────────────────────────────────────────────────────────────────

export const TEST_TRACK_NAME = "Firelink Shrine";
export const TEST_VIDEO_ID = "vid-abc";
export const TEST_VIDEO_TITLE = "Firelink Shrine - Dark Souls OST";
export const TEST_CHANNEL_TITLE = "GameOST";
export const TEST_THUMBNAIL_URL = "https://i.ytimg.com/vi/abc/default.jpg";
export const TEST_DURATION_SECONDS = 240;

// ─── Sessions / Playlists ───────────────────────────────────────────────────

export const TEST_PLAYLIST_ID = "pl1";
export const TEST_PLAYLIST_TRACK_ID = "pt1";
export const TEST_SESSION_NAME = "Test Session";
