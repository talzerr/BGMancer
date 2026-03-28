import { describe, it, expect, vi, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDB, clearStmtCache, seedTestUser, seedTestGame } from "../../test-helpers";
import { TEST_USER_ID, TEST_GAME_ID } from "@/test/constants";

let db: Database.Database;

vi.mock("@/lib/db", async () => {
  const { MOCK_LOCAL_USER_ID, MOCK_LOCAL_LIBRARY_ID } = await import("@/test/constants");
  return {
    getDB: () => db,
    LOCAL_USER_ID: MOCK_LOCAL_USER_ID,
    LOCAL_LIBRARY_ID: MOCK_LOCAL_LIBRARY_ID,
  };
});

const { Games } = await import("../games");
const { CurationMode } = await import("@/types");

beforeEach(() => {
  db = createTestDB();
  clearStmtCache();
  seedTestUser(db);
});

describe("Games", () => {
  describe("create", () => {
    describe("when creating a game with a Steam appid", () => {
      it("should create the game and link it to the user's library", () => {
        const game = Games.create(TEST_USER_ID, TEST_GAME_ID, "Celeste", undefined, 504230);
        expect(game.id).toBe(TEST_GAME_ID);
        expect(game.title).toBe("Celeste");
        expect(game.curation).toBe("include");
      });

      it("should set the thumbnail from the Steam appid", () => {
        const game = Games.create(TEST_USER_ID, TEST_GAME_ID, "Celeste", undefined, 504230);
        expect(game.thumbnail_url).toBe(
          "https://cdn.akamai.steamstatic.com/steam/apps/504230/header.jpg",
        );
      });
    });

    describe("when creating a game without a Steam appid", () => {
      it("should leave thumbnail_url as null", () => {
        const game = Games.create(TEST_USER_ID, TEST_GAME_ID, "Custom Game");
        expect(game.thumbnail_url).toBeNull();
      });
    });

    describe("when creating a game with a specific curation mode", () => {
      it("should store the curation mode in library_games", () => {
        const game = Games.create(TEST_USER_ID, TEST_GAME_ID, "A Game", CurationMode.Focus);
        expect(game.curation).toBe("focus");
      });
    });
  });

  describe("listAll", () => {
    describe("when library has published games with various curations", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: "g-inc", title: "Included", curation: "include" });
        seedTestGame(db, TEST_USER_ID, { id: "g-skip", title: "Skipped", curation: "skip" });
        seedTestGame(db, TEST_USER_ID, { id: "g-lite", title: "Lite", curation: "lite" });
        seedTestGame(db, TEST_USER_ID, { id: "g-focus", title: "Focused", curation: "focus" });
      });

      it("should return non-skip games", () => {
        const games = Games.listAll(TEST_USER_ID);
        const ids = games.map((g) => g.id);
        expect(ids).toContain("g-inc");
        expect(ids).toContain("g-lite");
        expect(ids).toContain("g-focus");
      });

      it("should NOT include skip-curated games", () => {
        const games = Games.listAll(TEST_USER_ID);
        const ids = games.map((g) => g.id);
        expect(ids).not.toContain("g-skip");
      });
    });

    describe("when library has unpublished games", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: "g-pub", title: "Published", published: true });
        seedTestGame(db, TEST_USER_ID, {
          id: "g-unpub",
          title: "Unpublished",
          published: false,
        });
      });

      it("should exclude unpublished games", () => {
        const games = Games.listAll(TEST_USER_ID);
        const ids = games.map((g) => g.id);
        expect(ids).toContain("g-pub");
        expect(ids).not.toContain("g-unpub");
      });
    });

    describe("when excludeId is provided", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "Game One" });
        seedTestGame(db, TEST_USER_ID, { id: "g2", title: "Game Two" });
      });

      it("should omit the excluded game", () => {
        const games = Games.listAll(TEST_USER_ID, TEST_GAME_ID);
        const ids = games.map((g) => g.id);
        expect(ids).not.toContain(TEST_GAME_ID);
        expect(ids).toContain("g2");
      });
    });

    describe("when library is empty", () => {
      it("should return an empty array", () => {
        expect(Games.listAll(TEST_USER_ID)).toEqual([]);
      });
    });
  });

  describe("listAllIncludingDisabled", () => {
    describe("when library has skip-curated games", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: "g-inc", title: "Included", curation: "include" });
        seedTestGame(db, TEST_USER_ID, { id: "g-skip", title: "Skipped", curation: "skip" });
      });

      it("should include skip-curated games", () => {
        const games = Games.listAllIncludingDisabled(TEST_USER_ID);
        const ids = games.map((g) => g.id);
        expect(ids).toContain("g-inc");
        expect(ids).toContain("g-skip");
      });
    });

    describe("when library has unpublished games", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, {
          id: "g-unpub",
          title: "Unpublished",
          published: false,
        });
      });

      it("should still exclude unpublished games", () => {
        const games = Games.listAllIncludingDisabled(TEST_USER_ID);
        const ids = games.map((g) => g.id);
        expect(ids).not.toContain("g-unpub");
      });
    });
  });

  describe("getById", () => {
    describe("when the game exists", () => {
      it("should return the game", () => {
        seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "Hollow Knight" });
        const game = Games.getById(TEST_GAME_ID);
        expect(game).not.toBeNull();
        expect(game!.title).toBe("Hollow Knight");
      });
    });

    describe("when the game does not exist", () => {
      it("should return null", () => {
        expect(Games.getById("nonexistent")).toBeNull();
      });
    });
  });

  describe("getByIdForUser", () => {
    describe("when the game is in the user's library", () => {
      it("should return the game with the correct curation", () => {
        seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "Celeste", curation: "focus" });
        const game = Games.getByIdForUser(TEST_USER_ID, TEST_GAME_ID);
        expect(game).not.toBeNull();
        expect(game!.curation).toBe("focus");
      });
    });

    describe("when the game exists but is not in the user's library", () => {
      it("should return null", () => {
        // Insert game directly without library link
        db.prepare("INSERT INTO games (id, title) VALUES (?, ?)").run("g-orphan", "Orphan Game");
        const game = Games.getByIdForUser(TEST_USER_ID, "g-orphan");
        expect(game).toBeNull();
      });
    });
  });

  describe("findByTitle", () => {
    beforeEach(() => {
      seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "Hollow Knight" });
    });

    describe("when searching with exact case", () => {
      it("should find the game", () => {
        const game = Games.findByTitle("Hollow Knight");
        expect(game).not.toBeNull();
        expect(game!.id).toBe(TEST_GAME_ID);
      });
    });

    describe("when searching with different case", () => {
      it("should find the game case-insensitively", () => {
        const game = Games.findByTitle("hollow knight");
        expect(game).not.toBeNull();
        expect(game!.id).toBe(TEST_GAME_ID);
      });

      it("should find the game with upper case", () => {
        const game = Games.findByTitle("HOLLOW KNIGHT");
        expect(game).not.toBeNull();
        expect(game!.id).toBe(TEST_GAME_ID);
      });
    });

    describe("when the title does not match", () => {
      it("should return null", () => {
        expect(Games.findByTitle("Nonexistent")).toBeNull();
      });
    });
  });

  describe("count", () => {
    describe("when library has real games and the yt-import entry", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: "game-a", title: "Game A" });
        seedTestGame(db, TEST_USER_ID, { id: "game-b", title: "Game B" });
        seedTestGame(db, TEST_USER_ID, { id: "yt-import", title: "YT Import" });
      });

      it("should count only real games, excluding yt-import", () => {
        expect(Games.count(TEST_USER_ID)).toBe(2);
      });
    });

    describe("when library is empty", () => {
      it("should return 0", () => {
        expect(Games.count(TEST_USER_ID)).toBe(0);
      });
    });
  });

  describe("setCuration", () => {
    describe("when changing curation mode", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "A Game", curation: "include" });
      });

      it("should update the curation mode", () => {
        Games.setCuration(TEST_USER_ID, TEST_GAME_ID, CurationMode.Focus);
        const game = Games.getByIdForUser(TEST_USER_ID, TEST_GAME_ID);
        expect(game!.curation).toBe("focus");
      });
    });
  });

  describe("remove", () => {
    describe("when removing a game from the library", () => {
      beforeEach(() => {
        seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "A Game" });
      });

      it("should remove the library link", () => {
        Games.remove(TEST_USER_ID, TEST_GAME_ID);
        const game = Games.getByIdForUser(TEST_USER_ID, TEST_GAME_ID);
        expect(game).toBeNull();
      });

      it("should NOT delete the game record itself", () => {
        Games.remove(TEST_USER_ID, TEST_GAME_ID);
        const game = Games.getById(TEST_GAME_ID);
        expect(game).not.toBeNull();
        expect(game!.title).toBe("A Game");
      });
    });
  });

  describe("linkToLibrary", () => {
    describe("when linking an existing game", () => {
      it("should create a library link", () => {
        db.prepare("INSERT INTO games (id, title) VALUES (?, ?)").run("g-orphan", "Orphan");
        Games.linkToLibrary(TEST_USER_ID, "g-orphan");
        const game = Games.getByIdForUser(TEST_USER_ID, "g-orphan");
        expect(game).not.toBeNull();
        expect(game!.curation).toBe("include");
      });
    });

    describe("when the link already exists", () => {
      it("should not throw (INSERT OR IGNORE)", () => {
        seedTestGame(db, TEST_USER_ID, { id: TEST_GAME_ID, title: "A Game" });
        expect(() => Games.linkToLibrary(TEST_USER_ID, TEST_GAME_ID)).not.toThrow();
      });
    });
  });

  describe("ensureExists", () => {
    describe("when the game does not exist", () => {
      it("should create the game with Skip curation", () => {
        Games.ensureExists(TEST_USER_ID, "new-game", "New Game");
        const game = Games.getByIdForUser(TEST_USER_ID, "new-game");
        expect(game).not.toBeNull();
        expect(game!.title).toBe("New Game");
        expect(game!.curation).toBe("skip");
      });
    });

    describe("when the game already exists in the games table", () => {
      beforeEach(() => {
        db.prepare("INSERT INTO games (id, title) VALUES (?, ?)").run("existing", "Existing Game");
      });

      it("should link it to the library with Skip curation without creating a duplicate", () => {
        Games.ensureExists(TEST_USER_ID, "existing", "Existing Game");
        const game = Games.getByIdForUser(TEST_USER_ID, "existing");
        expect(game).not.toBeNull();
        expect(game!.curation).toBe("skip");
      });

      it("should not overwrite the existing game record", () => {
        Games.ensureExists(TEST_USER_ID, "existing", "Different Title");
        const game = Games.getById("existing");
        expect(game!.title).toBe("Existing Game");
      });
    });

    describe("when called multiple times", () => {
      it("should be idempotent", () => {
        Games.ensureExists(TEST_USER_ID, "idem-game", "Idem Game");
        Games.ensureExists(TEST_USER_ID, "idem-game", "Idem Game");
        const count = db
          .prepare("SELECT COUNT(*) AS cnt FROM games WHERE id = ?")
          .get("idem-game") as { cnt: number };
        expect(count.cnt).toBe(1);
      });
    });
  });
});
