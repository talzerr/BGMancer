import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/time";

const NOW = new Date("2026-04-07T12:00:00.000Z");

function isoAgo(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

describe("formatRelativeTime", () => {
  it("returns 'just now' for zero diff", () => {
    expect(formatRelativeTime(NOW.toISOString(), NOW)).toBe("just now");
  });

  it("returns 'just now' for 59 seconds", () => {
    expect(formatRelativeTime(isoAgo(59 * 1000), NOW)).toBe("just now");
  });

  it("returns '1 minute ago' at exactly 60 seconds", () => {
    expect(formatRelativeTime(isoAgo(60 * 1000), NOW)).toBe("1 minute ago");
  });

  it("pluralizes minutes", () => {
    expect(formatRelativeTime(isoAgo(5 * 60 * 1000), NOW)).toBe("5 minutes ago");
  });

  it("returns '59 minutes ago' just under an hour", () => {
    expect(formatRelativeTime(isoAgo(59 * 60 * 1000), NOW)).toBe("59 minutes ago");
  });

  it("returns '1 hour ago' at exactly 60 minutes", () => {
    expect(formatRelativeTime(isoAgo(60 * 60 * 1000), NOW)).toBe("1 hour ago");
  });

  it("pluralizes hours", () => {
    expect(formatRelativeTime(isoAgo(2 * 60 * 60 * 1000), NOW)).toBe("2 hours ago");
  });

  it("returns '23 hours ago' just under a day", () => {
    expect(formatRelativeTime(isoAgo(23 * 60 * 60 * 1000), NOW)).toBe("23 hours ago");
  });

  it("returns 'yesterday' at exactly 24 hours", () => {
    expect(formatRelativeTime(isoAgo(24 * 60 * 60 * 1000), NOW)).toBe("yesterday");
  });

  it("returns '2 days ago' at 48 hours", () => {
    expect(formatRelativeTime(isoAgo(48 * 60 * 60 * 1000), NOW)).toBe("2 days ago");
  });

  it("returns '3 days ago' at 72 hours", () => {
    expect(formatRelativeTime(isoAgo(72 * 60 * 60 * 1000), NOW)).toBe("3 days ago");
  });

  it("returns 'just now' for negative diffs (future timestamps)", () => {
    expect(formatRelativeTime(new Date(NOW.getTime() + 5000).toISOString(), NOW)).toBe("just now");
  });
});
