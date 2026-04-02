import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDrizzleDB, seedTestUser } from "../../test-helpers";
import { TEST_USER_ID, TEST_USER_EMAIL } from "@/test/constants";
import type { DrizzleDB } from "@/lib/db";

const NEW_USER_ID = "new-user";

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

// Import after mock so the module binds to our mocked getDB
const { Users } = await import("../users");

beforeEach(() => {
  const testDb = createTestDrizzleDB();
  db = testDb.db;
  rawDb = testDb.rawDb;
  seedTestUser(rawDb);
});

describe("Users", () => {
  describe("createFromOAuth", () => {
    describe("when the email is new", () => {
      it("should create a user and library with username derived from email", async () => {
        const user = await Users.createFromOAuth("new@example.com");
        expect(user.email).toBe("new@example.com");
        expect(user.username).toBe("new");
        const lib = rawDb.prepare("SELECT * FROM libraries WHERE user_id = ?").get(user.id) as
          | Record<string, unknown>
          | undefined;
        expect(lib).toBeTruthy();
      });
    });

    describe("when the email already exists", () => {
      it("should return the existing user without duplicating", async () => {
        const user = await Users.createFromOAuth(TEST_USER_EMAIL);
        expect(user.id).toBe(TEST_USER_ID);
        expect(user.email).toBe(TEST_USER_EMAIL);
      });
    });
  });

  describe("getOrCreate", () => {
    describe("when user already exists", () => {
      it("should return the existing user", async () => {
        const user = await Users.getOrCreate(TEST_USER_ID);
        expect(user.id).toBe(TEST_USER_ID);
        expect(user.email).toBe(TEST_USER_EMAIL);
      });

      it("should not create a duplicate library", async () => {
        await Users.getOrCreate(TEST_USER_ID);
        await Users.getOrCreate(TEST_USER_ID);
        const libs = rawDb.prepare("SELECT * FROM libraries WHERE user_id = ?").all(TEST_USER_ID);
        expect(libs).toHaveLength(1);
      });
    });

    describe("when user does not exist", () => {
      it("should create user and library atomically", async () => {
        const user = await Users.getOrCreate(NEW_USER_ID);
        expect(user.id).toBe(NEW_USER_ID);
        const lib = rawDb.prepare("SELECT * FROM libraries WHERE user_id = ?").get(NEW_USER_ID) as
          | Record<string, unknown>
          | undefined;
        expect(lib).toBeTruthy();
      });
    });
  });

  describe("getById", () => {
    describe("when user exists", () => {
      it("should return the user", async () => {
        const user = await Users.getById(TEST_USER_ID);
        expect(user).not.toBeNull();
        expect(user!.id).toBe(TEST_USER_ID);
      });
    });

    describe("when user does not exist", () => {
      it("should return null", async () => {
        expect(await Users.getById("nonexistent")).toBeNull();
      });
    });
  });

  describe("tryAcquireGenerationLock", () => {
    describe("when no lock is held and no cooldown", () => {
      it("should acquire the lock", async () => {
        const result = await Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
        expect(result.acquired).toBe(true);
      });

      it("should set is_generating to 1", async () => {
        await Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
        const row = rawDb
          .prepare("SELECT is_generating FROM users WHERE id = ?")
          .get(TEST_USER_ID) as {
          is_generating: number;
        };
        expect(row.is_generating).toBe(1);
      });
    });

    describe("when a lock is already held", () => {
      beforeEach(async () => {
        await Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
      });

      it("should not acquire the lock", async () => {
        const result = await Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
        expect(result.acquired).toBe(false);
        expect(result.reason).toContain("already in progress");
      });
    });

    describe("when cooldown has not elapsed", () => {
      beforeEach(() => {
        rawDb
          .prepare(
            "UPDATE users SET last_generated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
          )
          .run(TEST_USER_ID);
      });

      it("should not acquire the lock", async () => {
        const result = await Users.tryAcquireGenerationLock(TEST_USER_ID, 60_000);
        expect(result.acquired).toBe(false);
        expect(result.reason).toContain("wait");
      });
    });

    describe("when user does not exist", () => {
      it("should return acquired false", async () => {
        const result = await Users.tryAcquireGenerationLock("nonexistent", 0);
        expect(result.acquired).toBe(false);
        expect(result.reason).toContain("not found");
      });
    });
  });

  describe("releaseGenerationLock", () => {
    describe("when lock is held", () => {
      beforeEach(async () => {
        await Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
      });

      it("should clear the is_generating flag", async () => {
        await Users.releaseGenerationLock(TEST_USER_ID);
        const row = rawDb
          .prepare("SELECT is_generating FROM users WHERE id = ?")
          .get(TEST_USER_ID) as {
          is_generating: number;
        };
        expect(row.is_generating).toBe(0);
      });

      it("should set last_generated_at", async () => {
        await Users.releaseGenerationLock(TEST_USER_ID);
        const row = rawDb
          .prepare("SELECT last_generated_at FROM users WHERE id = ?")
          .get(TEST_USER_ID) as { last_generated_at: string | null };
        expect(row.last_generated_at).not.toBeNull();
      });
    });
  });
});
