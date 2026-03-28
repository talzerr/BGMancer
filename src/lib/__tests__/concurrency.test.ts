import { describe, it, expect } from "vitest";
import { runConcurrent } from "../concurrency";

describe("runConcurrent", () => {
  describe("when processing items successfully", () => {
    it("should invoke fn for every item", async () => {
      const processed: number[] = [];
      await runConcurrent([1, 2, 3], 2, async (item) => {
        processed.push(item);
      });
      expect(processed.sort()).toEqual([1, 2, 3]);
    });
  });

  describe("when items list is empty", () => {
    it("should resolve immediately", async () => {
      const processed: number[] = [];
      await runConcurrent([], 5, async (item) => {
        processed.push(item);
      });
      expect(processed).toEqual([]);
    });
  });

  describe("when enforcing concurrency limit", () => {
    it("should not exceed the limit of concurrent workers", async () => {
      let active = 0;
      let maxActive = 0;
      const limit = 2;

      await runConcurrent([1, 2, 3, 4, 5], limit, async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      });

      expect(maxActive).toBeLessThanOrEqual(limit);
    });
  });

  describe("when a fn call rejects", () => {
    it("should propagate the error", async () => {
      await expect(
        runConcurrent([1, 2, 3], 2, async (item) => {
          if (item === 2) throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
    });
  });

  describe("when limit exceeds item count", () => {
    it("should process all items without error", async () => {
      const processed: number[] = [];
      await runConcurrent([1, 2], 10, async (item) => {
        processed.push(item);
      });
      expect(processed.sort()).toEqual([1, 2]);
    });
  });
});
