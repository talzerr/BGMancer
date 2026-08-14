import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "path";
import * as schema from "./drizzle-schema";
import { TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME, TEST_SESSION_NAME } from "@/test/constants";
import { PlaylistMode } from "@/types";
import type { DrizzleDB } from ".";

/**
 * Minimal better-sqlite3-shaped façade over PGlite so test call sites keep the
 * familiar `prepare(sql).get/all/run(...params)` form. All three are async.
 */
export interface TestRawDB {
  prepare(query: string): {
    get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined>;
    all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]>;
    run(...params: unknown[]): Promise<void>;
  };
}

/** Rewrites better-sqlite3 `?` placeholders into Postgres `$1..$n`. */
function toPgPlaceholders(query: string): string {
  let n = 0;
  return query.replace(/\?/g, () => `$${++n}`);
}

function createRawDB(pg: PGlite): TestRawDB {
  return {
    prepare(query: string) {
      const text = toPgPlaceholders(query);
      return {
        async get<T = Record<string, unknown>>(...params: unknown[]): Promise<T | undefined> {
          const res = await pg.query<T>(text, params);
          return res.rows[0];
        },
        async all<T = Record<string, unknown>>(...params: unknown[]): Promise<T[]> {
          const res = await pg.query<T>(text, params);
          return res.rows;
        },
        async run(...params: unknown[]): Promise<void> {
          await pg.query(text, params);
        },
      };
    },
  };
}

/** Every table in the schema, ordered arbitrarily — CASCADE handles dependencies. */
const ALL_TABLES = [
  "users",
  "user_steam_games",
  "games",
  "libraries",
  "library_games",
  "playlists",
  "playlist_tracks",
  "playlist_track_decisions",
  "tracks",
  "game_review_flags",
  "game_requests",
  "video_tracks",
];

/**
 * Creates a fresh in-memory Postgres (PGlite) with the full schema applied via
 * migrations. Returns both the Drizzle instance and a raw query shim.
 */
export async function createTestDrizzleDB(): Promise<{ db: DrizzleDB; rawDb: TestRawDB }> {
  const pg = new PGlite();
  const pgliteDb = drizzle(pg, { schema });
  await migrate(pgliteDb, { migrationsFolder: path.join(process.cwd(), "drizzle/migrations") });
  return { db: pgliteDb as unknown as DrizzleDB, rawDb: createRawDB(pg) };
}

/** Truncates every table so one PGlite instance can be reused across tests. */
export async function resetTestDB(rawDb: TestRawDB): Promise<void> {
  await rawDb.prepare(`TRUNCATE ${ALL_TABLES.join(", ")} RESTART IDENTITY CASCADE`).run();
}

/** Inserts a test user + library. Returns { userId, libraryId }. */
export async function seedTestUser(
  db: TestRawDB,
  userId = TEST_USER_ID,
): Promise<{ userId: string; libraryId: string }> {
  const libraryId = `lib-${userId}`;
  await db
    .prepare("INSERT INTO users (id, email, username) VALUES (?, ?, ?)")
    .run(userId, userId === TEST_USER_ID ? TEST_USER_EMAIL : `${userId}@test.com`, TEST_USER_NAME);
  await db.prepare("INSERT INTO libraries (id, user_id) VALUES (?, ?)").run(libraryId, userId);
  return { userId, libraryId };
}

/** Inserts a test game and links it to a user's library. Returns the game ID. */
export async function seedTestGame(
  db: TestRawDB,
  userId: string,
  overrides: {
    id?: string;
    title?: string;
    published?: boolean;
    curation?: string;
    steamAppid?: number | null;
    onboardingPhase?: string;
  } = {},
): Promise<string> {
  const id = overrides.id ?? `game-${Math.random().toString(36).slice(2, 8)}`;
  const title = overrides.title ?? "Test Game"; // intentional default — not TEST_GAME_TITLE since seeds may need unique names
  const published = overrides.published ?? true;
  const steamAppid = overrides.steamAppid ?? null;
  const onboardingPhase = overrides.onboardingPhase ?? "tagged";
  const curation = overrides.curation ?? "include";

  await db
    .prepare(
      "INSERT INTO games (id, title, steam_appid, onboarding_phase, published) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, title, steamAppid, onboardingPhase, published);

  const libraryId = await db
    .prepare("SELECT id FROM libraries WHERE user_id = ? LIMIT 1")
    .get<{ id: string }>(userId);

  if (libraryId) {
    await db
      .prepare("INSERT INTO library_games (library_id, game_id, curation) VALUES (?, ?, ?)")
      .run(libraryId.id, id, curation);
  }

  return id;
}

/** Inserts test tracks for a game. Returns the track names. */
export async function seedTestTracks(
  db: TestRawDB,
  gameId: string,
  count: number,
  tagged = false,
): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `Track ${i + 1}`;
    names.push(name);
    await db
      .prepare(
        `INSERT INTO tracks (game_id, name, position, energy, roles, moods, instrumentation, has_vocals, tagged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        gameId,
        name,
        i,
        tagged ? 2 : null,
        tagged ? ["ambient"] : null,
        tagged ? ["peaceful"] : null,
        tagged ? ["piano"] : null,
        tagged ? 0 : null,
        tagged ? new Date() : null,
      );
  }
  return names;
}

/** Inserts a test playlist (session) for a user. Returns the playlist ID. */
export async function seedTestSession(
  db: TestRawDB,
  userId: string,
  overrides: { id?: string; name?: string; isArchived?: boolean; playlistMode?: PlaylistMode } = {},
): Promise<string> {
  const id = overrides.id ?? `session-${Math.random().toString(36).slice(2, 8)}`;
  const name = overrides.name ?? TEST_SESSION_NAME;
  const isArchived = overrides.isArchived ?? false;
  const playlistMode = overrides.playlistMode ?? PlaylistMode.Journey;

  await db
    .prepare(
      "INSERT INTO playlists (id, user_id, name, is_archived, playlist_mode) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, userId, name, isArchived, playlistMode);

  return id;
}
