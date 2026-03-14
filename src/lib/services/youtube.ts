import type { YouTubeSearchResult } from "@/types";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

if (!process.env.YOUTUBE_API_KEY) {
  console.warn("[YouTube] WARNING: YOUTUBE_API_KEY is not set — all API calls will fail");
}

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY ?? "";

/** Thrown when the YouTube Data API quota is exceeded — callers should abort immediately */
export class YouTubeQuotaError extends Error {
  constructor() {
    super(
      "YouTube API quota exceeded. The free quota resets at midnight Pacific Time (PT). Try again tomorrow or create a new API key at console.cloud.google.com.",
    );
    this.name = "YouTubeQuotaError";
  }
}

/** Thrown when the YouTube API key is missing or invalid — callers should abort immediately */
export class YouTubeInvalidKeyError extends Error {
  constructor() {
    super(
      "YouTube API key is missing or invalid. Add a valid YOUTUBE_API_KEY to .env.local and restart the server.",
    );
    this.name = "YouTubeInvalidKeyError";
  }
}

/** Parse a YouTube error response body and throw a fatal error if applicable */
async function throwIfFatalError(res: Response): Promise<void> {
  const body = await res.text().catch(() => "");
  console.error(`[YouTube] ${res.url.split("?")[0]} failed — ${res.status} ${res.statusText}`);
  try {
    const parsed = JSON.parse(body);
    const reason = parsed?.error?.errors?.[0]?.reason;
    console.error(`[YouTube] reason: ${reason ?? "unknown"}`);
    if (reason === "quotaExceeded") throw new YouTubeQuotaError();
    const details: Array<{ reason?: string }> = parsed?.error?.details ?? [];
    if (details.some((d) => d.reason === "API_KEY_INVALID")) throw new YouTubeInvalidKeyError();
  } catch (e) {
    if (e instanceof YouTubeQuotaError || e instanceof YouTubeInvalidKeyError) throw e;
  }
  console.error(`[YouTube] response body: ${body}`);
}

const REJECT_KEYWORDS = [
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

const MIN_DURATION_SECONDS = 15 * 60; // 15 minutes

/** Parse ISO 8601 duration string (PT1H23M45S) to seconds */
function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] ?? "0");
  const minutes = parseInt(match[2] ?? "0");
  const seconds = parseInt(match[3] ?? "0");
  return hours * 3600 + minutes * 60 + seconds;
}

/** Check if a video should be rejected based on title/description */
function isRejected(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  return REJECT_KEYWORDS.some((kw) => haystack.includes(kw));
}

/**
 * Search YouTube and return validated results.
 * Uses search.list (100 units) + videos.list for duration (1 unit per video, max 10).
 */
export async function searchYouTube(
  query: string,
  allowShortVideo = false,
): Promise<YouTubeSearchResult[]> {
  const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
  searchUrl.searchParams.set("key", YOUTUBE_API_KEY);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "10");
  searchUrl.searchParams.set("videoCategoryId", "10");
  searchUrl.searchParams.set("order", "relevance");

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    console.error(`[YouTube] search.list — query: "${query}"`);
    await throwIfFatalError(searchRes);
    throw new Error(`YouTube search failed: ${searchRes.status} ${searchRes.statusText}`);
  }

  const searchData = await searchRes.json();
  const items: Array<{
    id: { videoId: string };
    snippet: {
      title: string;
      channelTitle: string;
      description: string;
      thumbnails: { high?: { url: string }; default?: { url: string } };
    };
  }> = searchData.items ?? [];

  if (items.length === 0) return [];

  const videoIds = items.map((i) => i.id.videoId).join(",");
  const videosUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
  videosUrl.searchParams.set("key", YOUTUBE_API_KEY);
  videosUrl.searchParams.set("id", videoIds);
  videosUrl.searchParams.set("part", "contentDetails");

  const videosRes = await fetch(videosUrl.toString());
  if (!videosRes.ok) {
    await throwIfFatalError(videosRes);
    throw new Error(`YouTube videos.list failed: ${videosRes.status} ${videosRes.statusText}`);
  }

  const videosData = await videosRes.json();
  const durationMap = new Map<string, number>();
  for (const v of videosData.items ?? []) {
    durationMap.set(v.id, parseDuration(v.contentDetails?.duration ?? "PT0S"));
  }

  const results: YouTubeSearchResult[] = [];

  for (const item of items) {
    const videoId = item.id.videoId;
    const title = item.snippet.title;
    const description = item.snippet.description;
    const channelTitle = item.snippet.channelTitle;
    const thumbnail =
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.default?.url ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const durationSeconds = durationMap.get(videoId) ?? 0;

    if (isRejected(title, description)) continue;
    if (!allowShortVideo && durationSeconds < MIN_DURATION_SECONDS) continue;

    results.push({ videoId, title, channelTitle, thumbnail, durationSeconds, description });
  }

  return results;
}

/**
 * Given multiple search queries (tried in order), return the best result.
 * Returns the first accepted video from the first query that produces results.
 */
export async function findBestVideo(
  queries: string[],
  allowShortVideo = false,
): Promise<YouTubeSearchResult | null> {
  for (const query of queries) {
    const results = await searchYouTube(query, allowShortVideo);
    if (results.length > 0) {
      return results[0];
    }
  }
  return null;
}

/**
 * Fetch durations for a batch of video IDs in a single videos.list call (1 quota unit).
 * Returns a map of videoId → duration in seconds.
 */
const YT_VIDEOS_PAGE_SIZE = 50; // YouTube videos.list max IDs per request

export async function fetchVideoDurations(videoIds: string[]): Promise<Map<string, number>> {
  const durations = new Map<string, number>();
  if (videoIds.length === 0) return durations;

  // Chunk into pages of 50 — the YouTube videos.list endpoint hard-caps at 50 IDs.
  for (let i = 0; i < videoIds.length; i += YT_VIDEOS_PAGE_SIZE) {
    const chunk = videoIds.slice(i, i + YT_VIDEOS_PAGE_SIZE);

    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("key", YOUTUBE_API_KEY);
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("part", "contentDetails");

    const res = await fetch(url.toString());
    if (!res.ok) {
      // throwIfFatalError re-throws on quota/auth errors; for other failures, skip this chunk
      await throwIfFatalError(res);
      console.warn(
        `[YouTube] fetchVideoDurations chunk ${i}–${i + YT_VIDEOS_PAGE_SIZE - 1} failed (${res.status}), skipping`,
      );
      continue; // best-effort: skip this chunk, keep results so far
    }

    const data = await res.json();
    for (const v of data.items ?? []) {
      durations.set(v.id, parseDuration(v.contentDetails?.duration ?? "PT0S"));
    }
  }

  return durations;
}

// ─── OST playlist discovery (read-only, uses API key) ────────────────────────

export interface OSTTrack {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
}

/**
 * Search YouTube for a game's official OST playlist.
 * Tries progressively broader queries and returns the best playlist ID found.
 */
export async function searchOSTPlaylist(gameTitle: string): Promise<string | null> {
  const queries = [
    `${gameTitle} original soundtrack official playlist`,
    `${gameTitle} OST full playlist`,
    `${gameTitle} complete soundtrack playlist`,
  ];

  const gameTitleWords = gameTitle
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const query of queries) {
    const url = new URL(`${YOUTUBE_API_BASE}/search`);
    url.searchParams.set("key", YOUTUBE_API_KEY);
    url.searchParams.set("q", query);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "playlist");
    url.searchParams.set("maxResults", "10");

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`[YouTube] searchOSTPlaylist — query: "${query}"`);
      await throwIfFatalError(res);
      continue;
    }

    const data = await res.json();
    const items: Array<{
      id: { playlistId: string };
      snippet: { title: string; channelTitle: string };
    }> = data.items ?? [];

    if (items.length === 0) continue;

    const match = items.find((item) => {
      const haystack = item.snippet.title.toLowerCase();
      return gameTitleWords.some((w) => haystack.includes(w));
    });

    const chosen = match ?? items[0];
    if (chosen?.id?.playlistId) return chosen.id.playlistId;
  }

  return null;
}

/**
 * Fetch playlist metadata (title, description, etc.) from YouTube.
 * Costs 1 quota unit.
 */
export async function fetchPlaylistMetadata(
  playlistId: string,
): Promise<{ title: string; description: string } | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
  url.searchParams.set("key", YOUTUBE_API_KEY);
  url.searchParams.set("id", playlistId);
  url.searchParams.set("part", "snippet");

  const res = await fetch(url.toString());
  if (!res.ok) {
    console.error(`[YouTube] fetchPlaylistMetadata — playlistId: ${playlistId}`);
    await throwIfFatalError(res);
    return null;
  }

  const data = await res.json();
  const items: Array<{ snippet: { title: string; description: string } }> = data.items ?? [];

  if (items.length === 0) return null;

  return {
    title: items[0].snippet.title,
    description: items[0].snippet.description,
  };
}

/**
 * Fetch up to `maxTracks` tracks from a YouTube playlist, paginating as needed.
 * Each page costs 1 quota unit (50 items per page).
 * Default cap is 150 tracks (3 pages) to give the LLM a larger, varied pool.
 */
export async function fetchPlaylistItems(playlistId: string, maxTracks = 150): Promise<OSTTrack[]> {
  const tracks: OSTTrack[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${YOUTUBE_API_BASE}/playlistItems`);
    url.searchParams.set("key", YOUTUBE_API_KEY);
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error(`[YouTube] fetchPlaylistItems — playlistId: ${playlistId}`);
      await throwIfFatalError(res);
      break;
    }

    const data = await res.json();
    const page: OSTTrack[] = (data.items ?? [])
      .map(
        (item: {
          snippet: {
            resourceId?: { videoId?: string };
            title: string;
            videoOwnerChannelTitle?: string;
            thumbnails?: { medium?: { url: string }; default?: { url: string } };
          };
        }) => ({
          videoId: item.snippet.resourceId?.videoId ?? "",
          title: item.snippet.title,
          channelTitle: item.snippet.videoOwnerChannelTitle ?? "",
          thumbnail:
            item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
        }),
      )
      .filter(
        (t: OSTTrack) => t.videoId && t.title !== "Deleted video" && t.title !== "Private video",
      );

    tracks.push(...page);
    pageToken = data.nextPageToken;
  } while (pageToken && tracks.length < maxTracks);

  return tracks.slice(0, maxTracks);
}

// ─── Playlist helpers (require user OAuth token) ──────────────────────────────

interface PlaylistItem {
  id: string;
  snippet: { title: string };
}

/** Find the "BGMancer Journey" playlist, or return null if not found */
export async function findBGMancerPlaylist(accessToken: string): Promise<string | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/playlists`);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Failed to list playlists: ${res.status}`);

  const data = await res.json();
  const playlists: PlaylistItem[] = data.items ?? [];
  const match = playlists.find((p) => p.snippet.title === "BGMancer Journey");
  return match?.id ?? null;
}

/** Create the "BGMancer Journey" playlist and return its ID */
export async function createBGMancerPlaylist(accessToken: string): Promise<string> {
  const res = await fetch(`${YOUTUBE_API_BASE}/playlists?part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        title: "BGMancer Journey",
        description:
          "AI-curated video game OST playlist, powered by BGMancer. Each entry is the best long-form official soundtrack found for that game.",
      },
      status: { privacyStatus: "public" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create playlist: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}

/** Add a video to a playlist. Returns the playlistItem ID. */
export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string,
): Promise<string> {
  const res = await fetch(`${YOUTUBE_API_BASE}/playlistItems?part=snippet`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to add video to playlist: ${res.status} — ${err}`);
  }

  const data = await res.json();
  return data.id as string;
}
