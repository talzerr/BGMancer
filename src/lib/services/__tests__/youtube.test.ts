import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseDuration,
  isRejected,
  searchYouTube,
  findBestVideo,
  fetchVideoMetadata,
  searchOSTPlaylist,
  fetchPlaylistMetadata,
  fetchPlaylistItems,
  findBGMancerPlaylist,
  createBGMancerPlaylist,
  addVideoToPlaylist,
  YouTubeQuotaError,
  YouTubeInvalidKeyError,
} from "../youtube";
import { TEST_GAME_TITLE, TEST_CHANNEL_TITLE } from "@/test/constants";

describe("parseDuration", () => {
  describe("when given a complete HMS duration string", () => {
    it("should return the total seconds", () => {
      expect(parseDuration("PT1H23M45S")).toBe(3600 + 23 * 60 + 45);
    });

    it("should handle large values", () => {
      expect(parseDuration("PT99H59M59S")).toBe(99 * 3600 + 59 * 60 + 59);
    });
  });

  describe("when given a partial duration string", () => {
    it("should parse hours only", () => {
      expect(parseDuration("PT2H")).toBe(7200);
    });

    it("should parse minutes only", () => {
      expect(parseDuration("PT10M")).toBe(600);
    });

    it("should parse seconds only", () => {
      expect(parseDuration("PT45S")).toBe(45);
    });

    it("should parse minutes and seconds without hours", () => {
      expect(parseDuration("PT5M30S")).toBe(330);
    });

    it("should parse hours and seconds without minutes", () => {
      expect(parseDuration("PT1H30S")).toBe(3630);
    });
  });

  describe("when given an invalid or empty string", () => {
    it("should return 0 for a day-only format", () => {
      expect(parseDuration("P1D")).toBe(0);
    });

    it("should return 0 for an empty string", () => {
      expect(parseDuration("")).toBe(0);
    });

    it("should return 0 for PT0S", () => {
      expect(parseDuration("PT0S")).toBe(0);
    });
  });
});

describe("isRejected", () => {
  describe("when no reject keywords are present", () => {
    it("should return false for a clean OST title", () => {
      expect(isRejected(`${TEST_GAME_TITLE} III OST`, "official soundtrack")).toBe(false);
    });

    it("should return false for empty inputs", () => {
      expect(isRejected("", "")).toBe(false);
    });
  });

  describe("when a keyword appears in the title", () => {
    it("should reject", () => {
      expect(isRejected("Skyrim Piano Cover", "")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(isRejected("JAZZ Remix", "")).toBe(true);
    });
  });

  describe("when a keyword appears only in the description", () => {
    it("should reject", () => {
      expect(isRejected("Elden Ring OST", "arranged by a fan")).toBe(true);
    });
  });

  describe("when multi-word or hyphenated keywords are used", () => {
    it("should reject 'fan made'", () => {
      expect(isRejected("fan made compilation", "")).toBe(true);
    });

    it("should reject 'lo-fi'", () => {
      expect(isRejected("lo-fi beats", "")).toBe(true);
    });

    it("should reject 'lofi'", () => {
      expect(isRejected("lofi study music", "")).toBe(true);
    });

    it("should reject 'orchestral remix'", () => {
      expect(isRejected("orchestral remix of battle theme", "")).toBe(true);
    });
  });

  describe("when checking all keywords exhaustively", () => {
    it("should reject every defined keyword", () => {
      const keywords = [
        "cover",
        "covers",
        "reaction",
        "reactions",
        "review",
        "reviews",
        "piano",
        "jazz",
        "remix",
        "remixes",
        "fan-made",
        "fan made",
        "arrangement",
        "arranged",
        "lofi",
        "lo-fi",
        "orchestral remix",
      ];
      for (const kw of keywords) {
        expect(isRejected(`OST ${kw} compilation`, "")).toBe(true);
      }
    });
  });

  describe("when title contains partial keyword matches", () => {
    it("should reject 'discover' because it contains 'cover'", () => {
      expect(isRejected("discover the music", "")).toBe(true);
    });

    it("should not false-positive on unrelated words", () => {
      expect(isRejected("Elden Ring Main Theme", "official game music")).toBe(false);
    });
  });
});

// ─── Mocked fetch tests ─────────────────────────────────────────────────────

const originalFetch = global.fetch;

function mockFetch(impl: (url: string, opts?: RequestInit) => Promise<Response>) {
  global.fetch = vi.fn(impl) as typeof fetch;
}

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => data,
    text: async () => JSON.stringify(data),
    url: "https://youtube.googleapis.com/test",
    headers: new Headers(),
  } as unknown as Response;
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe("searchYouTube", () => {
  describe("when the API returns valid results", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.includes("/search")) {
          return jsonResponse({
            items: [
              {
                id: { videoId: "vid1" },
                snippet: {
                  title: `${TEST_GAME_TITLE} OST`,
                  channelTitle: TEST_CHANNEL_TITLE,
                  description: "official soundtrack",
                  thumbnails: { high: { url: "https://thumb.jpg" } },
                },
              },
            ],
          });
        }
        // videos.list for durations
        return jsonResponse({
          items: [{ id: "vid1", contentDetails: { duration: "PT4M30S" } }],
        });
      });
    });

    it("should return matching videos", async () => {
      const results = await searchYouTube(`${TEST_GAME_TITLE} OST`);
      expect(results).toHaveLength(1);
      expect(results[0].videoId).toBe("vid1");
      expect(results[0].durationSeconds).toBe(270);
    });
  });

  describe("when results contain rejected keywords", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.includes("/search")) {
          return jsonResponse({
            items: [
              {
                id: { videoId: "vid1" },
                snippet: {
                  title: `${TEST_GAME_TITLE} Piano Cover`,
                  channelTitle: "Covers",
                  description: "",
                  thumbnails: { default: { url: "https://thumb.jpg" } },
                },
              },
              {
                id: { videoId: "vid2" },
                snippet: {
                  title: `${TEST_GAME_TITLE} OST Official`,
                  channelTitle: TEST_CHANNEL_TITLE,
                  description: "official",
                  thumbnails: { high: { url: "https://thumb2.jpg" } },
                },
              },
            ],
          });
        }
        return jsonResponse({
          items: [
            { id: "vid1", contentDetails: { duration: "PT4M30S" } },
            { id: "vid2", contentDetails: { duration: "PT5M0S" } },
          ],
        });
      });
    });

    it("should filter out rejected videos", async () => {
      const results = await searchYouTube(TEST_GAME_TITLE);
      expect(results).toHaveLength(1);
      expect(results[0].videoId).toBe("vid2");
    });

    it("should not include the rejected video", async () => {
      const results = await searchYouTube(TEST_GAME_TITLE);
      expect(results.find((r) => r.videoId === "vid1")).toBeUndefined();
    });
  });

  describe("when the search returns no items", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ items: [] }));
    });

    it("should return an empty array", async () => {
      const results = await searchYouTube("nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("when the API returns a quota error", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({ error: { errors: [{ reason: "quotaExceeded" }] } }, false, 403),
      );
    });

    it("should throw YouTubeQuotaError", async () => {
      await expect(searchYouTube("test")).rejects.toThrow(YouTubeQuotaError);
    });
  });

  describe("when the API returns an invalid key error", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({ error: { details: [{ reason: "API_KEY_INVALID" }] } }, false, 400),
      );
    });

    it("should throw YouTubeInvalidKeyError", async () => {
      await expect(searchYouTube("test")).rejects.toThrow(YouTubeInvalidKeyError);
    });
  });

  describe("when the search API returns a non-fatal error (generic 500)", () => {
    it("should throw a non-quota error", async () => {
      mockFetch(async () =>
        jsonResponse({ error: { errors: [{ reason: "backendError" }] } }, false, 500),
      );
      await expect(searchYouTube("test")).rejects.toThrow("YouTube search failed");
    });
  });

  describe("when the videos.list API returns a non-fatal error (generic 500)", () => {
    it("should throw a non-quota error", async () => {
      mockFetch(async (url) => {
        if (url.includes("/search")) {
          return jsonResponse({
            items: [
              {
                id: { videoId: "vid1" },
                snippet: {
                  title: "OST",
                  channelTitle: "C",
                  description: "official",
                  thumbnails: { default: { url: "t.jpg" } },
                },
              },
            ],
          });
        }
        return jsonResponse({ error: { errors: [{ reason: "backendError" }] } }, false, 500);
      });
      await expect(searchYouTube("test")).rejects.toThrow("YouTube videos.list failed");
    });
  });

  describe("when video exceeds YT_MAX_VIDEO_DURATION_SECONDS", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.includes("/search")) {
          return jsonResponse({
            items: [
              {
                id: { videoId: "long" },
                snippet: {
                  title: "Elden Ring Full OST",
                  channelTitle: "C",
                  description: "",
                  thumbnails: { default: { url: "t.jpg" } },
                },
              },
            ],
          });
        }
        return jsonResponse({
          items: [{ id: "long", contentDetails: { duration: "PT1H30M0S" } }],
        });
      });
    });

    it("should filter out videos longer than the max", async () => {
      const results = await searchYouTube("Elden Ring OST");
      expect(results).toHaveLength(0);
    });
  });

  describe("when video is under YT_MAX_VIDEO_DURATION_SECONDS", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.includes("/search")) {
          return jsonResponse({
            items: [
              {
                id: { videoId: "normal" },
                snippet: {
                  title: "Elden Ring - Main Theme",
                  channelTitle: "C",
                  description: "",
                  thumbnails: { default: { url: "t.jpg" } },
                },
              },
            ],
          });
        }
        return jsonResponse({
          items: [{ id: "normal", contentDetails: { duration: "PT3M30S" } }],
        });
      });
    });

    it("should include the video", async () => {
      const results = await searchYouTube("Elden Ring Main Theme");
      expect(results).toHaveLength(1);
    });
  });
});

describe("findBestVideo", () => {
  describe("when the first query returns results", () => {
    beforeEach(() => {
      mockFetch(async (url) => {
        if (url.includes("/search")) {
          return jsonResponse({
            items: [
              {
                id: { videoId: "best" },
                snippet: {
                  title: "Official OST",
                  channelTitle: "C",
                  description: "",
                  thumbnails: { default: { url: "t.jpg" } },
                },
              },
            ],
          });
        }
        return jsonResponse({
          items: [{ id: "best", contentDetails: { duration: "PT4M0S" } }],
        });
      });
    });

    it("should return the first result from the first query", async () => {
      const result = await findBestVideo(["query1", "query2"]);
      expect(result).not.toBeNull();
      expect(result!.videoId).toBe("best");
    });

    it("should not try subsequent queries", async () => {
      await findBestVideo(["query1", "query2"]);
      // fetch called twice (search + videos), not four times
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("when no queries return results", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ items: [] }));
    });

    it("should return null", async () => {
      expect(await findBestVideo(["q1", "q2"])).toBeNull();
    });
  });
});

describe("fetchVideoMetadata", () => {
  describe("when given video IDs", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [
            {
              id: "v1",
              contentDetails: { duration: "PT3M20S" },
              statistics: { viewCount: "150000" },
            },
            {
              id: "v2",
              contentDetails: { duration: "PT5M0S" },
              statistics: { viewCount: "50000" },
            },
          ],
        }),
      );
    });

    it("should return a map of videoId to metadata", async () => {
      const result = await fetchVideoMetadata(["v1", "v2"]);
      expect(result.size).toBe(2);
      expect(result.get("v1")!.durationSeconds).toBe(200);
      expect(result.get("v1")!.viewCount).toBe(150000);
      expect(result.get("v2")!.viewCount).toBe(50000);
    });
  });

  describe("when given an empty array", () => {
    it("should return an empty map without making API calls", async () => {
      mockFetch(async () => {
        throw new Error("Should not be called");
      });
      const result = await fetchVideoMetadata([]);
      expect(result.size).toBe(0);
    });
  });

  describe("when a video has no statistics", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [{ id: "v1", contentDetails: { duration: "PT1M0S" } }],
        }),
      );
    });

    it("should set viewCount to null", async () => {
      const result = await fetchVideoMetadata(["v1"]);
      expect(result.get("v1")!.viewCount).toBeNull();
    });
  });

  describe("when the API returns a quota error", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({ error: { errors: [{ reason: "quotaExceeded" }] } }, false, 403),
      );
    });

    it("should throw YouTubeQuotaError", async () => {
      await expect(fetchVideoMetadata(["v1"])).rejects.toThrow(YouTubeQuotaError);
    });
  });

  describe("when a chunk fails with a non-fatal error", () => {
    it("should skip the failed chunk and return results from successful chunks", async () => {
      let callCount = 0;
      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          // First chunk succeeds
          return jsonResponse({
            items: Array.from({ length: 50 }, (_, i) => ({
              id: `v${i}`,
              contentDetails: { duration: "PT3M0S" },
              statistics: { viewCount: "1000" },
            })),
          });
        }
        // Second chunk fails with generic 500
        return jsonResponse({ error: { errors: [{ reason: "backendError" }] } }, false, 500);
      });

      // 60 IDs triggers two chunks (50 + 10)
      const ids = Array.from({ length: 60 }, (_, i) => `v${i}`);
      const result = await fetchVideoMetadata(ids);
      // Only first chunk's 50 results should be present
      expect(result.size).toBe(50);
      expect(result.has("v0")).toBe(true);
      expect(result.has("v50")).toBe(false);
    });
  });
});

describe("searchOSTPlaylist", () => {
  describe("when a matching playlist is found", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [
            {
              id: { playlistId: "PL_abc" },
              snippet: { title: `${TEST_GAME_TITLE} Full OST`, channelTitle: TEST_CHANNEL_TITLE },
            },
          ],
        }),
      );
    });

    it("should return the playlist ID", async () => {
      const result = await searchOSTPlaylist(TEST_GAME_TITLE);
      expect(result).toBe("PL_abc");
    });
  });

  describe("when no playlists are found", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ items: [] }));
    });

    it("should return null", async () => {
      expect(await searchOSTPlaylist("Unknown Game")).toBeNull();
    });
  });

  describe("when a search query fails with a non-fatal error", () => {
    it("should continue to the next query", async () => {
      let callCount = 0;
      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          // First query fails with generic 500
          return jsonResponse({ error: { errors: [{ reason: "backendError" }] } }, false, 500);
        }
        // Second query succeeds
        return jsonResponse({
          items: [
            {
              id: { playlistId: "PL_fallback" },
              snippet: { title: `${TEST_GAME_TITLE} Full OST`, channelTitle: TEST_CHANNEL_TITLE },
            },
          ],
        });
      });

      const result = await searchOSTPlaylist(TEST_GAME_TITLE);
      expect(result).toBe("PL_fallback");
    });
  });
});

describe("fetchPlaylistMetadata", () => {
  describe("when the playlist exists", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [{ snippet: { title: "OST", description: "desc" } }],
        }),
      );
    });

    it("should return title and description", async () => {
      const result = await fetchPlaylistMetadata("PL_abc");
      expect(result).toEqual({ title: "OST", description: "desc" });
    });
  });

  describe("when the playlist does not exist", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ items: [] }));
    });

    it("should return null", async () => {
      expect(await fetchPlaylistMetadata("PL_missing")).toBeNull();
    });
  });

  describe("when the API returns an error", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({}, false, 500));
    });

    it("should return null", async () => {
      expect(await fetchPlaylistMetadata("PL_bad")).toBeNull();
    });
  });
});

describe("fetchPlaylistItems", () => {
  describe("when the playlist has items", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [
            {
              snippet: {
                resourceId: { videoId: "v1" },
                title: "Track 1",
                videoOwnerChannelTitle: "Channel",
                thumbnails: { medium: { url: "t.jpg" } },
              },
            },
            {
              snippet: {
                resourceId: { videoId: "v2" },
                title: "Track 2",
                videoOwnerChannelTitle: "Channel",
                thumbnails: { default: { url: "t2.jpg" } },
              },
            },
          ],
        }),
      );
    });

    it("should return parsed tracks", async () => {
      const tracks = await fetchPlaylistItems("PL_abc");
      expect(tracks).toHaveLength(2);
      expect(tracks[0].videoId).toBe("v1");
      expect(tracks[1].title).toBe("Track 2");
    });
  });

  describe("when items include deleted or private videos", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [
            {
              snippet: {
                resourceId: { videoId: "v1" },
                title: "Good Track",
                videoOwnerChannelTitle: "C",
                thumbnails: {},
              },
            },
            {
              snippet: {
                resourceId: { videoId: "v2" },
                title: "Deleted video",
                videoOwnerChannelTitle: "",
                thumbnails: {},
              },
            },
            {
              snippet: {
                resourceId: { videoId: "v3" },
                title: "Private video",
                videoOwnerChannelTitle: "",
                thumbnails: {},
              },
            },
          ],
        }),
      );
    });

    it("should filter out deleted and private videos", async () => {
      const tracks = await fetchPlaylistItems("PL_abc");
      expect(tracks).toHaveLength(1);
      expect(tracks[0].videoId).toBe("v1");
    });
  });

  describe("when a page fetch fails with a non-fatal error", () => {
    it("should stop pagination and return tracks collected so far", async () => {
      let callCount = 0;
      mockFetch(async () => {
        callCount++;
        if (callCount === 1) {
          // First page succeeds with a nextPageToken
          return jsonResponse({
            items: [
              {
                snippet: {
                  resourceId: { videoId: "v1" },
                  title: "Track 1",
                  videoOwnerChannelTitle: "Channel",
                  thumbnails: { default: { url: "t.jpg" } },
                },
              },
            ],
            nextPageToken: "page2",
          });
        }
        // Second page fails with generic 500
        return jsonResponse({ error: { errors: [{ reason: "backendError" }] } }, false, 500);
      });

      const tracks = await fetchPlaylistItems("PL_abc");
      expect(tracks).toHaveLength(1);
      expect(tracks[0].videoId).toBe("v1");
    });
  });

  describe("when maxTracks limits the result", () => {
    beforeEach(() => {
      const items = Array.from({ length: 5 }, (_, i) => ({
        snippet: {
          resourceId: { videoId: `v${i}` },
          title: `Track ${i}`,
          videoOwnerChannelTitle: "C",
          thumbnails: {},
        },
      }));
      mockFetch(async () => jsonResponse({ items }));
    });

    it("should truncate to maxTracks", async () => {
      const tracks = await fetchPlaylistItems("PL_abc", 3);
      expect(tracks).toHaveLength(3);
    });
  });
});

describe("findBGMancerPlaylist", () => {
  describe("when the playlist exists", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [
            { id: "PL_other", snippet: { title: "Other" } },
            { id: "PL_bgm", snippet: { title: "BGMancer Journey" } },
          ],
        }),
      );
    });

    it("should return its ID", async () => {
      expect(await findBGMancerPlaylist("token")).toBe("PL_bgm");
    });
  });

  describe("when the playlist does not exist", () => {
    beforeEach(() => {
      mockFetch(async () =>
        jsonResponse({
          items: [{ id: "PL_other", snippet: { title: "Other" } }],
        }),
      );
    });

    it("should return null", async () => {
      expect(await findBGMancerPlaylist("token")).toBeNull();
    });
  });

  describe("when the API call fails", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({}, false, 401));
    });

    it("should throw", async () => {
      await expect(findBGMancerPlaylist("bad-token")).rejects.toThrow();
    });
  });
});

describe("createBGMancerPlaylist", () => {
  describe("when successful", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ id: "PL_new" }));
    });

    it("should return the new playlist ID", async () => {
      expect(await createBGMancerPlaylist("token")).toBe("PL_new");
    });
  });

  describe("when the API fails", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({}, false, 403));
    });

    it("should throw", async () => {
      await expect(createBGMancerPlaylist("token")).rejects.toThrow("Failed to create playlist");
    });
  });
});

describe("addVideoToPlaylist", () => {
  describe("when successful", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({ id: "item-123" }));
    });

    it("should return the playlistItem ID", async () => {
      expect(await addVideoToPlaylist("token", "PL_1", "vid_1")).toBe("item-123");
    });
  });

  describe("when the API fails", () => {
    beforeEach(() => {
      mockFetch(async () => jsonResponse({}, false, 403));
    });

    it("should throw", async () => {
      await expect(addVideoToPlaylist("token", "PL_1", "vid_1")).rejects.toThrow(
        "Failed to add video",
      );
    });
  });
});

describe("throwIfFatalError (edge case)", () => {
  describe("when res.text() throws", () => {
    beforeEach(() => {
      mockFetch(
        async () =>
          ({
            ok: false,
            status: 500,
            statusText: "Internal Server Error",
            url: "https://youtube.googleapis.com/test",
            headers: new Headers(),
            json: async () => ({}),
            text: async () => {
              throw new Error("body stream already consumed");
            },
          }) as unknown as Response,
      );
    });

    it("should still throw the generic error", async () => {
      await expect(searchYouTube("test")).rejects.toThrow("YouTube search failed");
    });
  });
});
