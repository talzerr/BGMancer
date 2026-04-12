/**
 * User-OAuth YouTube write operations. These endpoints require an
 * `access_token` from the signed-in user and mutate their YouTube account —
 * they are called only by the `POST /api/sync` route.
 *
 * Failures are surfaced as typed `YouTubeOAuthError`s so the route can map
 * `status + reason` to user-facing error categories (re-auth, signup,
 * quota, etc.) without parsing error strings.
 */

import { YOUTUBE_API_BASE, log } from "./core";

export type YoutubePlaylistPrivacy = "public" | "unlisted" | "private";

/** Thrown by OAuth-authenticated YouTube write paths so routes can map
 *  status + reason to user-facing error categories. */
export class YouTubeOAuthError extends Error {
  readonly status: number;
  readonly reason: string | null;
  constructor(status: number, reason: string | null, body: string) {
    super(`YouTube API ${status}${reason ? ` (${reason})` : ""}: ${body}`);
    this.name = "YouTubeOAuthError";
    this.status = status;
    this.reason = reason;
  }
}

/** Parse an OAuth-path error response and throw a typed YouTubeOAuthError. */
async function throwYoutubeOAuthError(res: Response): Promise<never> {
  const body = await res.text().catch(() => "");
  let reason: string | null = null;
  try {
    const parsed = JSON.parse(body);
    reason = parsed?.error?.errors?.[0]?.reason ?? null;
  } catch {
    // body may not be JSON — fine, reason stays null
  }
  log.error("youtube oauth request failed", {
    url: res.url.split("?")[0],
    status: res.status,
    reason: reason ?? "unknown",
  });
  throw new YouTubeOAuthError(res.status, reason, body);
}

/** Create a new YouTube playlist and return its ID. */
export async function createYoutubePlaylist(
  accessToken: string,
  opts: { title: string; description: string; privacy: YoutubePlaylistPrivacy },
): Promise<string> {
  const res = await fetch(`${YOUTUBE_API_BASE}/playlists?part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: { title: opts.title, description: opts.description },
      status: { privacyStatus: opts.privacy },
    }),
  });

  if (!res.ok) await throwYoutubeOAuthError(res);
  const data = (await res.json()) as { id: string };
  return data.id;
}

/** Add a video to a playlist at the given position. Returns the playlistItem ID. */
export async function addVideoToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string,
  position?: number,
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
        ...(position !== undefined ? { position } : {}),
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });

  if (!res.ok) await throwYoutubeOAuthError(res);
  const data = (await res.json()) as { id: string };
  return data.id;
}
