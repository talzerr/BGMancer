import { describe, it, expect } from "vitest";
import { matchRoute } from "../route-matcher";
import { AuthLevel } from "../route-config";

describe("matchRoute", () => {
  describe("page routes", () => {
    it("should match the home page", () => {
      expect(matchRoute("GET", "/")).toEqual({ auth: AuthLevel.Public });
    });

    it("should match /library", () => {
      expect(matchRoute("GET", "/library")).toEqual({ auth: AuthLevel.Public });
    });

    it("should return null for unregistered pages", () => {
      expect(matchRoute("GET", "/nonexistent")).toBeNull();
      expect(matchRoute("GET", "/foo/bar")).toBeNull();
    });
  });

  describe("API routes with method matching", () => {
    it("should match GET /api/games as optional", () => {
      expect(matchRoute("GET", "/api/games")).toEqual({ auth: AuthLevel.Optional });
    });

    it("should match POST /api/games as required", () => {
      expect(matchRoute("POST", "/api/games")).toEqual({ auth: AuthLevel.Required });
    });

    it("should not match an unregistered method", () => {
      expect(matchRoute("PUT", "/api/games")).toBeNull();
    });

    it("should match GET /api/games/catalog as public", () => {
      expect(matchRoute("GET", "/api/games/catalog")).toEqual({ auth: AuthLevel.Public });
    });
  });

  describe("dynamic segments", () => {
    it("should match /api/sessions/[id] with any id", () => {
      expect(matchRoute("PATCH", "/api/sessions/abc-123")).toEqual({ auth: AuthLevel.Required });
      expect(matchRoute("DELETE", "/api/sessions/xyz")).toEqual({ auth: AuthLevel.Required });
    });

    it("should match /api/playlist/[id]/reroll", () => {
      expect(matchRoute("POST", "/api/playlist/some-track-id/reroll")).toEqual({
        auth: AuthLevel.Required,
      });
    });

    it("should match /backstage/games/[slug]", () => {
      expect(matchRoute("GET", "/backstage/games/hollow-knight")).toEqual({
        auth: AuthLevel.Admin,
      });
    });

    it("should not match extra segments beyond the pattern", () => {
      expect(matchRoute("GET", "/api/sessions/abc/extra")).toBeNull();
    });
  });

  describe("wildcard routes", () => {
    it("should match /api/backstage/* for any sub-path", () => {
      expect(matchRoute("GET", "/api/backstage/games")).toEqual({ auth: AuthLevel.Admin });
      expect(matchRoute("POST", "/api/backstage/retag")).toEqual({ auth: AuthLevel.Admin });
      expect(matchRoute("GET", "/api/backstage/games/abc/tracks")).toEqual({
        auth: AuthLevel.Admin,
      });
    });

    it("should match /api/auth/* for nextauth routes", () => {
      expect(matchRoute("GET", "/api/auth/signin")).toEqual({ auth: AuthLevel.Public });
      expect(matchRoute("POST", "/api/auth/callback/google")).toEqual({ auth: AuthLevel.Public });
    });
  });

  describe("admin routes", () => {
    it("should match backstage pages as admin", () => {
      expect(matchRoute("GET", "/backstage")).toEqual({ auth: AuthLevel.Admin });
      expect(matchRoute("GET", "/backstage/tracks")).toEqual({ auth: AuthLevel.Admin });
      expect(matchRoute("GET", "/backstage/theatre")).toEqual({ auth: AuthLevel.Admin });
    });
  });

  describe("unregistered routes", () => {
    it("should return null for completely unknown paths", () => {
      expect(matchRoute("GET", "/admin")).toBeNull();
      expect(matchRoute("GET", "/api/unknown")).toBeNull();
      expect(matchRoute("POST", "/api/unknown/route")).toBeNull();
    });
  });
});
