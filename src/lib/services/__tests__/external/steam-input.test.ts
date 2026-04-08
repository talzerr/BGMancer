import { describe, it, expect } from "vitest";
import { parseSteamInput, InvalidSteamUrlError } from "@/lib/services/external/steam-input";

describe("parseSteamInput", () => {
  describe("when given a vanity URL", () => {
    it("parses as vanity", () => {
      expect(parseSteamInput("https://steamcommunity.com/id/foo")).toEqual({
        kind: "vanity",
        value: "foo",
      });
    });

    it("trims trailing slashes", () => {
      expect(parseSteamInput("https://steamcommunity.com/id/foo/")).toEqual({
        kind: "vanity",
        value: "foo",
      });
    });

    it("accepts http:// variant", () => {
      expect(parseSteamInput("http://steamcommunity.com/id/bar")).toEqual({
        kind: "vanity",
        value: "bar",
      });
    });
  });

  describe("when given a profile URL", () => {
    it("parses as profile", () => {
      expect(parseSteamInput("https://steamcommunity.com/profiles/76561198000000000")).toEqual({
        kind: "profile",
        value: "76561198000000000",
      });
    });
  });

  describe("when given a bare 17-digit SteamID64", () => {
    it("parses as id", () => {
      expect(parseSteamInput("76561198000000000")).toEqual({
        kind: "id",
        value: "76561198000000000",
      });
    });
  });

  describe("when given gibberish", () => {
    it("throws InvalidSteamUrlError", () => {
      expect(() => parseSteamInput("not a url")).toThrow(InvalidSteamUrlError);
    });

    it("throws on empty string", () => {
      expect(() => parseSteamInput("")).toThrow(InvalidSteamUrlError);
    });
  });
});
