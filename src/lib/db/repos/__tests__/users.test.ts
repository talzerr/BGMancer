import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDB, clearStmtCache, seedTestUser } from "../../test-helpers";
import { TEST_USER_ID, TEST_USER_EMAIL } from "@/test/constants";

const NEW_USER_ID = "new-user";

let db: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

// Import after mock so the module binds to our mocked getDB
const { Users } = await import("../users");

beforeEach(() => {
  db = createTestDB();
  clearStmtCache();
  seedTestUser(db);
});

describe("Users", () => {
  describe("getOrCreate", () => {
    describe("when user already exists", () => {
      it("should return the existing user", () => {
        const user = Users.getOrCreate(TEST_USER_ID);
        expect(user.id).toBe(TEST_USER_ID);
        expect(user.email).toBe(TEST_USER_EMAIL);
      });

      it("should not create a duplicate library", () => {
        Users.getOrCreate(TEST_USER_ID);
        Users.getOrCreate(TEST_USER_ID);
        const libs = db.prepare("SELECT * FROM libraries WHERE user_id = ?").all(TEST_USER_ID);
        expect(libs).toHaveLength(1);
      });
    });

    describe("when user does not exist", () => {
      it("should create user and library atomically", () => {
        const user = Users.getOrCreate(NEW_USER_ID);
        expect(user.id).toBe(NEW_USER_ID);
        const lib = db.prepare("SELECT * FROM libraries WHERE user_id = ?").get(NEW_USER_ID) as
          | Record<string, unknown>
          | undefined;
        expect(lib).toBeTruthy();
      });
    });
  });

  describe("getById", () => {
    describe("when user exists", () => {
      it("should return the user", () => {
        const user = Users.getById(TEST_USER_ID);
        expect(user).not.toBeNull();
        expect(user!.id).toBe(TEST_USER_ID);
      });
    });

    describe("when user does not exist", () => {
      it("should return null", () => {
        expect(Users.getById("nonexistent")).toBeNull();
      });
    });
  });

  describe("tryAcquireGenerationLock", () => {
    describe("when no lock is held and no cooldown", () => {
      it("should acquire the lock", () => {
        const result = Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
        expect(result.acquired).toBe(true);
      });

      it("should set is_generating to 1", () => {
        Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
        const row = db
          .prepare("SELECT is_generating FROM users WHERE id = ?")
          .get(TEST_USER_ID) as {
          is_generating: number;
        };
        expect(row.is_generating).toBe(1);
      });
    });

    describe("when a lock is already held", () => {
      beforeEach(() => {
        Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
      });

      it("should not acquire the lock", () => {
        const result = Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
        expect(result.acquired).toBe(false);
        expect(result.reason).toContain("already in progress");
      });
    });

    describe("when cooldown has not elapsed", () => {
      beforeEach(() => {
        // Set last_generated_at to now
        db.prepare(
          "UPDATE users SET last_generated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?",
        ).run(TEST_USER_ID);
      });

      it("should not acquire the lock", () => {
        const result = Users.tryAcquireGenerationLock(TEST_USER_ID, 60_000);
        expect(result.acquired).toBe(false);
        expect(result.reason).toContain("wait");
      });
    });

    describe("when user does not exist", () => {
      it("should return acquired false", () => {
        const result = Users.tryAcquireGenerationLock("nonexistent", 0);
        expect(result.acquired).toBe(false);
        expect(result.reason).toContain("not found");
      });
    });
  });

  describe("releaseGenerationLock", () => {
    describe("when lock is held", () => {
      beforeEach(() => {
        Users.tryAcquireGenerationLock(TEST_USER_ID, 0);
      });

      it("should clear the is_generating flag", () => {
        Users.releaseGenerationLock(TEST_USER_ID);
        const row = db
          .prepare("SELECT is_generating FROM users WHERE id = ?")
          .get(TEST_USER_ID) as {
          is_generating: number;
        };
        expect(row.is_generating).toBe(0);
      });

      it("should set last_generated_at", () => {
        Users.releaseGenerationLock(TEST_USER_ID);
        const row = db
          .prepare("SELECT last_generated_at FROM users WHERE id = ?")
          .get(TEST_USER_ID) as { last_generated_at: string | null };
        expect(row.last_generated_at).not.toBeNull();
      });
    });
  });
});
