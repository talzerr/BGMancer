import type { Game, Track, ResolvedTrack } from "@/types";
import { ReviewReason } from "@/types";
import type { LLMProvider } from "@/lib/llm/provider";
import type { OSTTrack } from "@/lib/services/youtube";
import { searchYouTube } from "@/lib/services/youtube";
import { Tracks, VideoTracks, ReviewFlags } from "@/lib/db/repo";
import { RESOLVE_BATCH_SIZE, RESOLVE_FALLBACK_MAX } from "@/lib/constants";

// ─── LLM response shape ───────────────────────────────────────────────────────

interface AlignmentItem {
  video_index: number;
  track_index: number | null;
  confidence: number; // 0–1
}

const SYSTEM_PROMPT = `You are a music metadata alignment assistant for a video game OST library.

You will be given two lists:
- VIDEOS: YouTube playlist video titles (indexed 1-based)
- TRACKS: canonical track names from a music database (indexed 1-based)

Your task: for each VIDEO, identify which TRACK it represents, or null if no match.

Return a JSON array with one entry per VIDEO:
- "video_index": the 1-based index of the video
- "track_index": the 1-based index of the matching track, or null if no match
- "confidence": a number from 0 to 1 (use < 0.6 for uncertain matches)

Guidelines:
- Ignore track numbers, game title prefix, "OST", "Soundtrack", "Theme", "-" separators in video titles
- Prefer exact name matches; allow minor differences (punctuation, capitalization, short words)
- A video may match only one track; each track should match at most one video
- Track names may be in Japanese while video titles are in English, or vice versa.
  Match by translated meaning when you can infer it (e.g. "戦闘" → "Battle"), but reduce confidence by ~0.2 compared to what you would assign an equivalent same-language match.
- Return ONLY a JSON array. No markdown fences or other text.`;

// ─── Track name extraction ────────────────────────────────────────────────────

/**
 * Strip game title, "OST"/"Soundtrack", leading track numbers, and other noise
 * from a YouTube video title to produce a candidate track name.
 */
function extractTrackName(videoTitle: string, gameTitle: string): string {
  let name = videoTitle;

  // Remove game title prefix (case-insensitive)
  const escaped = gameTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  name = name.replace(new RegExp(`^${escaped}\\s*[-–—:]?\\s*`, "i"), "");

  // Remove common suffix/prefix noise
  name = name
    .replace(/\bO\.?S\.?T\.?\b/gi, "")
    .replace(/\bOriginal Soundtrack\b/gi, "")
    .replace(/\bSoundtrack\b/gi, "")
    .replace(/\bTheme\b/gi, "")
    .replace(/^\s*\d+[.)]\s*/, "") // leading track number: "03. " or "3) "
    .replace(/\s*[-–—]\s*$/, "") // trailing dash
    .trim();

  return name || videoTitle;
}

// ─── Build ResolvedTrack from lookups ─────────────────────────────────────────

function toResolvedTrack(video: OSTTrack, track: Track): ResolvedTrack {
  return {
    videoId: video.videoId,
    videoTitle: video.title,
    channelTitle: video.channelTitle,
    thumbnail: video.thumbnail,
    gameId: track.gameId,
    trackName: track.name,
    energy: track.energy,
    roles: track.roles,
    moods: track.moods,
    instrumentation: track.instrumentation,
    hasVocals: track.hasVocals,
  };
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveTracksToVideos(
  game: Game,
  tracks: Track[],
  playlistItems: OSTTrack[],
  provider: LLMProvider,
): Promise<ResolvedTrack[]> {
  const activeTracks = tracks.filter((t) => t.active);

  // Build quick-lookup maps
  const videoMap = new Map<string, OSTTrack>(playlistItems.map((v) => [v.videoId, v]));
  const trackByName = new Map<string, Track>(activeTracks.map((t) => [t.name, t]));

  // ── 1. Early exit: load existing mappings ──────────────────────────────────
  const existingTrackToVideo = VideoTracks.getTrackToVideo(game.id);
  const unresolvedTracks = activeTracks.filter((t) => !existingTrackToVideo.has(t.name));

  // Accumulate all rows to persist at the end
  const newRows: { videoId: string; gameId: string; trackName: string | null }[] = [];

  if (unresolvedTracks.length === 0) {
    return buildResults(activeTracks, existingTrackToVideo, videoMap);
  }

  // ── 2. LLM playlist alignment ──────────────────────────────────────────────
  // Track which video_ids have already been matched to avoid double-assigning
  const matchedVideoIds = new Set<string>(existingTrackToVideo.values());
  const resolvedByLLM = new Map<string, string>(); // track_name → video_id

  // Only consider videos not already mapped
  const candidateVideos = playlistItems.filter((v) => !matchedVideoIds.has(v.videoId));

  for (let i = 0; i < candidateVideos.length; i += RESOLVE_BATCH_SIZE) {
    const batchVideos = candidateVideos.slice(i, i + RESOLVE_BATCH_SIZE);
    const batchNum = Math.floor(i / RESOLVE_BATCH_SIZE) + 1;

    const userPrompt = buildAlignmentPrompt(game.title, batchVideos, unresolvedTracks);

    let raw: string;
    try {
      raw = await provider.complete(SYSTEM_PROMPT, userPrompt, {
        temperature: 0.1,
        maxTokens: 4096,
      });
    } catch (err) {
      console.error(`[resolver] LLM call failed for game "${game.title}" batch ${batchNum}:`, err);
      ReviewFlags.markAsNeedsReview(
        game.id,
        ReviewReason.LlmCallFailed,
        `alignment batch ${batchNum}: ${String(err)}`,
      );
      continue;
    }

    let parsed: AlignmentItem[];
    try {
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found in response");
      parsed = JSON.parse(jsonMatch[0]) as AlignmentItem[];
    } catch (err) {
      console.error(
        `[resolver] Failed to parse LLM response for game "${game.title}" batch ${batchNum}:`,
        err,
      );
      ReviewFlags.markAsNeedsReview(
        game.id,
        ReviewReason.LlmParseFailed,
        `alignment batch ${batchNum}: ${String(err)}`,
      );
      continue;
    }

    const matchedInBatch = new Set<number>(); // track_index values used in this batch

    for (const item of parsed) {
      if (
        typeof item.video_index !== "number" ||
        item.video_index < 1 ||
        item.video_index > batchVideos.length
      ) {
        continue;
      }

      const video = batchVideos[item.video_index - 1];
      if (!video || matchedVideoIds.has(video.videoId)) continue;

      if (item.track_index === null || item.track_index === undefined) {
        // Video intentionally unmatched — will be handled in auto-discovery
        continue;
      }

      if (
        typeof item.track_index !== "number" ||
        item.track_index < 1 ||
        item.track_index > unresolvedTracks.length ||
        matchedInBatch.has(item.track_index)
      ) {
        continue;
      }

      const confidence = typeof item.confidence === "number" ? item.confidence : 1;
      if (confidence < 0.6) {
        ReviewFlags.markAsNeedsReview(
          game.id,
          ReviewReason.LowConfidence,
          `video "${video.title}" → track "${unresolvedTracks[item.track_index - 1]?.name}"`,
        );
      }

      const track = unresolvedTracks[item.track_index - 1];
      if (!track) continue;

      matchedInBatch.add(item.track_index);
      matchedVideoIds.add(video.videoId);
      resolvedByLLM.set(track.name, video.videoId);
      newRows.push({ videoId: video.videoId, gameId: game.id, trackName: track.name });
    }

    // ── 3. Auto-discovery for unmatched videos in this batch ──────────────
    for (const video of batchVideos) {
      if (matchedVideoIds.has(video.videoId)) continue;

      const candidateName = extractTrackName(video.title, game.title);
      if (!candidateName) continue;

      // Skip if a track with this name already exists in DB (active or not)
      const existsInDB = tracks.some((t) => t.name.toLowerCase() === candidateName.toLowerCase());
      if (existsInDB) {
        // Still record the video→track mapping if we can find it
        const matchedTrack = tracks.find(
          (t) => t.name.toLowerCase() === candidateName.toLowerCase(),
        );
        if (matchedTrack && !matchedVideoIds.has(video.videoId)) {
          matchedVideoIds.add(video.videoId);
          newRows.push({ videoId: video.videoId, gameId: game.id, trackName: matchedTrack.name });
        }
        continue;
      }

      // Insert discovered (inactive) track BEFORE video_tracks row (FK constraint)
      Tracks.insertDiscovered(game.id, candidateName);
      matchedVideoIds.add(video.videoId);
      newRows.push({ videoId: video.videoId, gameId: game.id, trackName: candidateName });

      // Refresh local track map so subsequent lookups find it
      const discoveredTrack: Track = {
        gameId: game.id,
        name: candidateName,
        position: 0,
        energy: null,
        roles: [],
        moods: [],
        instrumentation: [],
        hasVocals: null,
        active: false,
        taggedAt: null,
      };
      trackByName.set(candidateName, discoveredTrack);
    }
  }

  // Flag game for review if auto-discovery created new tracks
  const discoveredCount = newRows.filter(
    (r) => r.trackName !== null && !trackByName.has(r.trackName),
  ).length;
  if (discoveredCount > 0) {
    ReviewFlags.markAsNeedsReview(
      game.id,
      ReviewReason.AlignmentFailed,
      `${discoveredCount} track(s) auto-discovered from YouTube titles`,
    );
  }

  // ── 4. Per-track fallback for still-unresolved active tracks ──────────────
  const allResolved = new Map([...existingTrackToVideo, ...resolvedByLLM]);
  const stillUnresolved = activeTracks.filter((t) => !allResolved.has(t.name));
  let fallbackCount = 0;

  for (const track of stillUnresolved) {
    if (fallbackCount >= RESOLVE_FALLBACK_MAX) break;

    const query = `${game.title} ${track.name} OST`;
    try {
      const results = await searchYouTube(query, true);
      if (results.length > 0) {
        const result = results[0];
        allResolved.set(track.name, result.videoId);

        // Add to videoMap so we can build the result
        videoMap.set(result.videoId, {
          videoId: result.videoId,
          title: result.title,
          channelTitle: result.channelTitle,
          thumbnail: result.thumbnail,
        });

        newRows.push({ videoId: result.videoId, gameId: game.id, trackName: track.name });
      }
    } catch (err) {
      console.error(`[resolver] Fallback search failed for "${track.name}":`, err);
    }

    fallbackCount++;
  }

  // ── 5. Persist ─────────────────────────────────────────────────────────────
  VideoTracks.upsertBatch(newRows);

  // ── 6. Return ResolvedTrack[] ──────────────────────────────────────────────
  return buildResults(activeTracks, allResolved, videoMap);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAlignmentPrompt(gameTitle: string, videos: OSTTrack[], tracks: Track[]): string {
  const videoLines = videos.map((v, i) => `${i + 1}. ${v.title}`).join("\n");
  const trackLines = tracks.map((t, i) => `${i + 1}. ${t.name}`).join("\n");
  return `Game: ${gameTitle}\n\nVIDEOS:\n${videoLines}\n\nTRACKS:\n${trackLines}`;
}

function buildResults(
  activeTracks: Track[],
  trackToVideo: Map<string, string>,
  videoMap: Map<string, OSTTrack>,
): ResolvedTrack[] {
  const results: ResolvedTrack[] = [];

  for (const track of activeTracks) {
    const videoId = trackToVideo.get(track.name);
    if (!videoId) continue;

    const video = videoMap.get(videoId);
    if (!video) continue;

    results.push(toResolvedTrack(video, track));
  }

  return results;
}
