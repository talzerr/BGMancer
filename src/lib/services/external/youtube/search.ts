/**
 * Track-level search and metadata against the YouTube Data API (read-only,
 * authenticated via API key). Used by the onboarding resolver to find
 * candidate video IDs for individual tracks.
 */

import {
  YOUTUBE_API_BASE,
  getYouTubeApiKey,
  isRejected,
  log,
  parseDuration,
  throwIfFatalError,
} from "./core";
import { YT_MAX_VIDEO_DURATION_SECONDS, YT_VIDEOS_PAGE_SIZE } from "@/lib/constants";

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  durationSeconds: number;
  description: string;
}

/**
 * Search YouTube and return validated results.
 * Uses search.list (100 units) + videos.list for duration (1 unit per video, max 10).
 */
export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
  const searchUrl = new URL(`${YOUTUBE_API_BASE}/search`);
  searchUrl.searchParams.set("key", getYouTubeApiKey());
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "10");
  searchUrl.searchParams.set("videoCategoryId", "10");
  searchUrl.searchParams.set("order", "relevance");

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    log.error("search.list failed", { query });
    await throwIfFatalError(searchRes);
    throw new Error(`YouTube search failed: ${searchRes.status} ${searchRes.statusText}`);
  }

  const searchData = (await searchRes.json()) as {
    items?: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        channelTitle: string;
        description: string;
        thumbnails: { high?: { url: string }; default?: { url: string } };
      };
    }>;
  };
  const items = searchData.items ?? [];

  if (items.length === 0) return [];

  const videoIds = items.map((i) => i.id.videoId).join(",");
  const videosUrl = new URL(`${YOUTUBE_API_BASE}/videos`);
  videosUrl.searchParams.set("key", getYouTubeApiKey());
  videosUrl.searchParams.set("id", videoIds);
  videosUrl.searchParams.set("part", "contentDetails");

  const videosRes = await fetch(videosUrl.toString());
  if (!videosRes.ok) {
    await throwIfFatalError(videosRes);
    throw new Error(`YouTube videos.list failed: ${videosRes.status} ${videosRes.statusText}`);
  }

  const videosData = (await videosRes.json()) as {
    items?: Array<{ id: string; contentDetails?: { duration?: string } }>;
  };
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
    if (durationSeconds > YT_MAX_VIDEO_DURATION_SECONDS) continue;

    results.push({ videoId, title, channelTitle, thumbnail, durationSeconds, description });
  }

  return results;
}

export interface VideoMetadata {
  durationSeconds: number;
  viewCount: number | null;
}

/**
 * Fetch durations and view counts for a batch of video IDs in `videos.list`
 * calls (1 quota unit per chunk of 50). Returns a map of videoId →
 * { durationSeconds, viewCount }. Adding `statistics` alongside
 * `contentDetails` does not increase the quota cost — `videos.list` remains
 * 1 unit per call regardless of how many parts are requested.
 */
export async function fetchVideoMetadata(videoIds: string[]): Promise<Map<string, VideoMetadata>> {
  const result = new Map<string, VideoMetadata>();
  if (videoIds.length === 0) return result;

  // Chunk into pages of 50 — the YouTube videos.list endpoint hard-caps at 50 IDs.
  for (let i = 0; i < videoIds.length; i += YT_VIDEOS_PAGE_SIZE) {
    const chunk = videoIds.slice(i, i + YT_VIDEOS_PAGE_SIZE);

    const url = new URL(`${YOUTUBE_API_BASE}/videos`);
    url.searchParams.set("key", getYouTubeApiKey());
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("part", "contentDetails,statistics");

    const res = await fetch(url.toString());
    if (!res.ok) {
      // throwIfFatalError re-throws on quota/auth errors; for other failures, skip this chunk
      await throwIfFatalError(res);
      log.warn("fetchVideoMetadata chunk failed", {
        chunkStart: i,
        chunkEnd: i + chunk.length - 1,
        status: res.status,
        skipped: chunk.length,
      });
      continue; // best-effort: skip this chunk, keep results so far
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        contentDetails?: { duration?: string };
        statistics?: { viewCount?: string };
      }>;
    };
    for (const v of data.items ?? []) {
      const rawViews = v.statistics?.viewCount;
      const parsedViews = rawViews != null ? Number(rawViews) : null;
      result.set(v.id, {
        durationSeconds: parseDuration(v.contentDetails?.duration ?? "PT0S"),
        viewCount: parsedViews != null && Number.isFinite(parsedViews) ? parsedViews : null,
      });
    }
  }

  return result;
}
