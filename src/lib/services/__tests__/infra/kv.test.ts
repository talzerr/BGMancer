import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { KV } from "../../infra/kv";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("KV.set / KV.get", () => {
  it("should store and retrieve a value", async () => {
    await KV.set("test:basic", { foo: 1 });
    expect(await KV.get("test:basic")).toEqual({ foo: 1 });
  });

  it("should return null for missing keys", async () => {
    expect(await KV.get("test:missing")).toBeNull();
  });

  it("should overwrite existing values", async () => {
    await KV.set("test:overwrite", "first");
    await KV.set("test:overwrite", "second");
    expect(await KV.get("test:overwrite")).toBe("second");
  });

  it("should handle different value types", async () => {
    await KV.set("test:string", "hello");
    await KV.set("test:number", 42);
    await KV.set("test:array", [1, 2, 3]);
    await KV.set("test:bool", true);
    await KV.set("test:null", null);

    expect(await KV.get("test:string")).toBe("hello");
    expect(await KV.get("test:number")).toBe(42);
    expect(await KV.get("test:array")).toEqual([1, 2, 3]);
    expect(await KV.get("test:bool")).toBe(true);
    expect(await KV.get("test:null")).toBeNull();
  });
});

describe("KV.get with TTL", () => {
  it("should return value before TTL expires", async () => {
    await KV.set("test:ttl", "alive", 60);
    vi.advanceTimersByTime(59_000);
    expect(await KV.get("test:ttl")).toBe("alive");
  });

  it("should return null after TTL expires", async () => {
    await KV.set("test:ttl-expire", "gone", 60);
    vi.advanceTimersByTime(61_000);
    expect(await KV.get("test:ttl-expire")).toBeNull();
  });

  it("should persist indefinitely without TTL", async () => {
    await KV.set("test:no-ttl", "forever");
    vi.advanceTimersByTime(999_999_999);
    expect(await KV.get("test:no-ttl")).toBe("forever");
  });
});

describe("KV.getString", () => {
  it("should return raw JSON string", async () => {
    await KV.set("test:raw", { nested: true });
    expect(await KV.getString("test:raw")).toBe('{"nested":true}');
  });

  it("should return null for missing keys", async () => {
    expect(await KV.getString("test:raw-missing")).toBeNull();
  });
});

describe("KV.del", () => {
  it("should delete an existing key", async () => {
    await KV.set("test:del", "value");
    await KV.del("test:del");
    expect(await KV.get("test:del")).toBeNull();
  });

  it("should not error when deleting a missing key", async () => {
    await expect(KV.del("test:del-missing")).resolves.toBeUndefined();
  });
});

describe("KV.has", () => {
  it("should return true for existing keys", async () => {
    await KV.set("test:has", "yes");
    expect(await KV.has("test:has")).toBe(true);
  });

  it("should return false for missing keys", async () => {
    expect(await KV.has("test:has-missing")).toBe(false);
  });

  it("should return false after TTL expires", async () => {
    await KV.set("test:has-ttl", "temp", 10);
    vi.advanceTimersByTime(11_000);
    expect(await KV.has("test:has-ttl")).toBe(false);
  });
});
