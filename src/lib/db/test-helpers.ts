import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import * as schema from "./drizzle-schema";
import { TEST_USER_ID, TEST_USER_EMAIL, TEST_USER_NAME, TEST_SESSION_NAME } from "@/test/constants";
import type { DrizzleDB } from ".";

/**
 * Creates a fresh in-memory Drizzle-wrapped database with the full schema
 * applied via migrations. Returns both the Drizzle instance and the raw DB.
 */
export function createTestDrizzleDB(): { db: DrizzleDB; rawDb: Database.Database } {
  const rawDb = new Database(":memory:");
  rawDb.pragma("foreign_keys = ON");
  const db = drizzle(rawDb, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle/migrations") });
  return { db, rawDb };
}

/** Inserts a test user + library. Returns { userId, libraryId }. */
export function seedTestUser(
  db: Database.Database,
  userId = TEST_USER_ID,
): { userId: string; libraryId: string } {
  const libraryId = `lib-${userId}`;
  db.prepare("INSERT INTO users (id, email, username) VALUES (?, ?, ?)").run(
    userId,
    userId === TEST_USER_ID ? TEST_USER_EMAIL : `${userId}@test.com`,
    TEST_USER_NAME,
  );
  db.prepare("INSERT INTO libraries (id, user_id) VALUES (?, ?)").run(libraryId, userId);
  return { userId, libraryId };
}

/** Inserts a test game and links it to a user's library. Returns the game ID. */
export function seedTestGame(
  db: Database.Database,
  userId: string,
  overrides: {
    id?: string;
    title?: string;
    published?: boolean;
    curation?: string;
    steamAppid?: number | null;
    onboardingPhase?: string;
  } = {},
): string {
  const id = overrides.id ?? `game-${Math.random().toString(36).slice(2, 8)}`;
  const title = overrides.title ?? "Test Game"; // intentional default — not TEST_GAME_TITLE since seeds may need unique names
  const published = overrides.published ?? true;
  const steamAppid = overrides.steamAppid ?? null;
  const onboardingPhase = overrides.onboardingPhase ?? "tagged";
  const curation = overrides.curation ?? "include";

  db.prepare(
    "INSERT INTO games (id, title, steam_appid, onboarding_phase, published) VALUES (?, ?, ?, ?, ?)",
  ).run(id, title, steamAppid, onboardingPhase, published ? 1 : 0);

  const libraryId = db.prepare("SELECT id FROM libraries WHERE user_id = ? LIMIT 1").get(userId) as
    | { id: string }
    | undefined;

  if (libraryId) {
    db.prepare("INSERT INTO library_games (library_id, game_id, curation) VALUES (?, ?, ?)").run(
      libraryId.id,
      id,
      curation,
    );
  }

  return id;
}

/** Inserts test tracks for a game. Returns the track names. */
export function seedTestTracks(
  db: Database.Database,
  gameId: string,
  count: number,
  tagged = false,
): string[] {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const name = `Track ${i + 1}`;
    names.push(name);
    db.prepare(
      `INSERT INTO tracks (game_id, name, position, energy, roles, moods, instrumentation, has_vocals, tagged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      gameId,
      name,
      i,
      tagged ? 2 : null,
      tagged ? '["ambient"]' : null,
      tagged ? '["peaceful"]' : null,
      tagged ? '["piano"]' : null,
      tagged ? 0 : null,
      tagged ? new Date().toISOString() : null,
    );
  }
  return names;
}

/** Inserts a test playlist (session) for a user. Returns the playlist ID. */
export function seedTestSession(
  db: Database.Database,
  userId: string,
  overrides: { id?: string; name?: string; isArchived?: boolean } = {},
): string {
  const id = overrides.id ?? `session-${Math.random().toString(36).slice(2, 8)}`;
  const name = overrides.name ?? TEST_SESSION_NAME;
  const isArchived = overrides.isArchived ?? false;

  db.prepare("INSERT INTO playlists (id, user_id, name, is_archived) VALUES (?, ?, ?, ?)").run(
    id,
    userId,
    name,
    isArchived ? 1 : 0,
  );

  return id;
}
