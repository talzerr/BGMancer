/**
 * Official soundtrack (OST) playlist discovery against the YouTube Data API.
 * Read-only, authenticated via API key. Used during game onboarding to pull
 * a candidate video list that the LLM can align against the game's
 * authoritative tracklist.
 */

import { YOUTUBE_API_BASE, getYouTubeApiKey, log, throwIfFatalError } from "./core";

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
    url.searchParams.set("key", getYouTubeApiKey());
    url.searchParams.set("q", query);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "playlist");
    url.searchParams.set("maxResults", "10");

    const res = await fetch(url.toString());
    if (!res.ok) {
      log.error("searchOSTPlaylist failed", { query });
      await throwIfFatalError(res);
      continue;
    }

    const data = (await res.json()) as {
      items?: Array<{
        id: { playlistId: string };
        snippet: { title: string; channelTitle: string };
      }>;
    };
    const items = data.items ?? [];

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
  url.searchParams.set("key", getYouTubeApiKey());
  url.searchParams.set("id", playlistId);
  url.searchParams.set("part", "snippet");

  const res = await fetch(url.toString());
  if (!res.ok) {
    log.error("fetchPlaylistMetadata failed", { playlistId });
    await throwIfFatalError(res);
    return null;
  }

  const data = (await res.json()) as {
    items?: Array<{ snippet: { title: string; description: string } }>;
  };
  const items = data.items ?? [];

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
    url.searchParams.set("key", getYouTubeApiKey());
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("maxResults", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      log.error("fetchPlaylistItems failed", { playlistId });
      await throwIfFatalError(res);
      break;
    }

    const data = (await res.json()) as {
      items?: Array<{
        snippet: {
          resourceId?: { videoId?: string };
          title: string;
          videoOwnerChannelTitle?: string;
          thumbnails?: { medium?: { url: string }; default?: { url: string } };
        };
      }>;
      nextPageToken?: string;
    };
    const page: OSTTrack[] = (data.items ?? [])
      .map((item) => ({
        videoId: item.snippet.resourceId?.videoId ?? "",
        title: item.snippet.title,
        channelTitle: item.snippet.videoOwnerChannelTitle ?? "",
        thumbnail:
          item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
      }))
      .filter((t) => t.videoId && t.title !== "Deleted video" && t.title !== "Private video");

    tracks.push(...page);
    pageToken = data.nextPageToken;
  } while (pageToken && tracks.length < maxTracks);

  return tracks.slice(0, maxTracks);
}
