/**
 * Public surface for the YouTube Data API client. Callers import from
 * `@/lib/services/external/youtube` — this barrel re-exports from the
 * responsibility-specific modules under this directory.
 *
 * - `core` — shared primitives, error classes (quota/invalid key), parsing
 * - `search` — track-level search + metadata (onboarding resolver)
 * - `ost-playlists` — OST playlist discovery + item enumeration (onboarding)
 * - `sync` — user-OAuth writes (POST /api/sync)
 */

export { YouTubeInvalidKeyError, YouTubeQuotaError, isRejected, parseDuration } from "./core";

export {
  fetchVideoMetadata,
  searchYouTube,
  type VideoMetadata,
  type YouTubeSearchResult,
} from "./search";

export {
  fetchPlaylistItems,
  fetchPlaylistMetadata,
  searchOSTPlaylist,
  type OSTTrack,
} from "./ost-playlists";

export {
  YouTubeOAuthError,
  addVideoToPlaylist,
  createYoutubePlaylist,
  type YoutubePlaylistPrivacy,
} from "./sync";
