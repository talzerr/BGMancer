import type { LLMProvider } from "@/lib/llm";
import type { OSTTrack } from "@/lib/services/youtube";
import type { TaggedTrack, TrackRole } from "@/types";
import { TrackTags } from "@/lib/db/repo";
import { TAG_BATCH_SIZE, TAG_POOL_MAX } from "@/lib/constants";

const VALID_ROLES = new Set<TrackRole>([
  "opener",
  "ambient",
  "build",
  "combat",
  "closer",
  "menu",
  "cinematic",
]);

const TAGGER_SYSTEM = `You are a Video Game Music metadata tagger. Given a game title and a list of raw YouTube track titles, return structured metadata for each track.

Output ONLY a valid JSON array. No markdown, no explanation. Each element:
{ "index": <1-based>, "cleanName": "<display name>", "energy": <1|2|3>, "role": "<role>", "isJunk": <boolean> }

Fields:
- index: the 1-based track number from the input list
- cleanName: the track name cleaned of game title, "OST", "BGM", "Soundtrack", track numbers, and other YouTube noise. Preserve the actual track name exactly (apostrophes, colons, dashes, parentheses).
- energy: 1=calm/ambient, 2=moderate/exploration, 3=intense/combat
- role: one of "opener", "ambient", "build", "combat", "closer", "menu", "cinematic"
- isJunk: true if the track is a sound effect, test track, duplicate variant "(Ver. 2)", very short stinger, or non-music content

Role guide:
- opener: title screen, intro themes
- ambient: calm exploration, environmental
- build: rising tension, dungeon, puzzle
- combat: battle, boss, chase
- closer: ending, credits, epilogue
- menu: menu screens, save points, shop
- cinematic: cutscene, story, emotional set pieces`;

interface TagResult {
  index: number;
  cleanName: string;
  energy: number;
  role: string;
  isJunk: boolean;
}

function parseTagResponse(raw: string, batchSize: number): TagResult[] {
  const cleaned = raw.replace(/^```json?\n?/, "").replace(/\n?```$/, "");
  const parsed: unknown[] = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Not an array");

  const results: TagResult[] = [];
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const index = Number(obj.index);
    if (!Number.isInteger(index) || index < 1 || index > batchSize) continue;

    const energy = Number(obj.energy);
    const validEnergy = energy === 1 || energy === 2 || energy === 3 ? energy : 2;
    const role = VALID_ROLES.has(obj.role as TrackRole) ? (obj.role as TrackRole) : "ambient";

    results.push({
      index,
      cleanName:
        typeof obj.cleanName === "string" && obj.cleanName.trim() ? obj.cleanName.trim() : "",
      energy: validEnergy,
      role,
      isJunk: obj.isJunk === true,
    });
  }
  return results;
}

async function tagBatch(
  gameTitle: string,
  tracks: OSTTrack[],
  provider: LLMProvider,
): Promise<Map<number, TagResult>> {
  const numbered = tracks.map((t, i) => `${i + 1}. ${t.title}`).join("\n");
  const user = `Game: "${gameTitle}"

Tracks (${tracks.length} total):
${numbered}

Tag every track. Return a JSON array with ${tracks.length} elements.`;

  const raw = await provider.complete(TAGGER_SYSTEM, user, { temperature: 0.3 });
  const results = parseTagResponse(raw, tracks.length);

  const map = new Map<number, TagResult>();
  for (const r of results) map.set(r.index - 1, r);
  return map;
}

/**
 * Tags all tracks for a game with structured metadata.
 * Checks the DB cache first; only sends uncached tracks to the LLM.
 * Returns all non-junk tagged tracks.
 */
export async function tagGameTracks(
  gameId: string,
  gameTitle: string,
  tracks: OSTTrack[],
  provider: LLMProvider,
): Promise<TaggedTrack[]> {
  const pool = tracks.slice(0, TAG_POOL_MAX);

  // Check cache
  const cachedTags = TrackTags.getByVideoIds(
    pool.map((t) => t.videoId),
    gameId,
  );
  const cachedByVideoId = new Map(cachedTags.map((t) => [t.videoId, t]));

  // Separate cached vs uncached
  const uncachedTracks: Array<{ index: number; track: OSTTrack }> = [];
  for (let i = 0; i < pool.length; i++) {
    if (!cachedByVideoId.has(pool[i].videoId)) {
      uncachedTracks.push({ index: i, track: pool[i] });
    }
  }

  // Tag uncached tracks in batches
  const newTags = new Map<string, TagResult>();
  for (let i = 0; i < uncachedTracks.length; i += TAG_BATCH_SIZE) {
    const batch = uncachedTracks.slice(i, i + TAG_BATCH_SIZE);
    const batchTracks = batch.map((b) => b.track);

    try {
      const tagMap = await tagBatch(gameTitle, batchTracks, provider);
      for (const [batchIdx, result] of tagMap) {
        const videoId = batchTracks[batchIdx]?.videoId;
        if (videoId) {
          if (!result.cleanName) result.cleanName = batchTracks[batchIdx].title;
          newTags.set(videoId, result);
        }
      }

      // Fill in any tracks the LLM missed in this batch
      for (let j = 0; j < batchTracks.length; j++) {
        if (!newTags.has(batchTracks[j].videoId)) {
          newTags.set(batchTracks[j].videoId, {
            index: j,
            cleanName: batchTracks[j].title,
            energy: 2,
            role: "ambient",
            isJunk: false,
          });
        }
      }
    } catch {
      // On parse failure, assign defaults for entire batch
      for (const b of batch) {
        newTags.set(b.track.videoId, {
          index: b.index,
          cleanName: b.track.title,
          energy: 2,
          role: "ambient",
          isJunk: false,
        });
      }
    }
  }

  // Persist new tags to DB
  if (newTags.size > 0) {
    const rows = [...newTags.entries()].map(([videoId, tag]) => ({
      videoId,
      gameId,
      cleanName: tag.cleanName,
      energy: tag.energy,
      role: tag.role,
      isJunk: tag.isJunk,
    }));
    TrackTags.upsertBatch(rows);
  }

  // Build final TaggedTrack array from cache + new tags
  const result: TaggedTrack[] = [];
  for (const track of pool) {
    const cached = cachedByVideoId.get(track.videoId);
    const fresh = newTags.get(track.videoId);

    if (cached) {
      if (cached.isJunk) continue;
      result.push({
        videoId: track.videoId,
        title: track.title,
        channelTitle: track.channelTitle,
        thumbnail: track.thumbnail,
        gameId,
        gameTitle,
        cleanName: cached.cleanName,
        energy: cached.energy,
        role: cached.role,
        isJunk: false,
      });
    } else if (fresh) {
      if (fresh.isJunk) continue;
      result.push({
        videoId: track.videoId,
        title: track.title,
        channelTitle: track.channelTitle,
        thumbnail: track.thumbnail,
        gameId,
        gameTitle,
        cleanName: fresh.cleanName,
        energy: fresh.energy as 1 | 2 | 3,
        role: fresh.role as TrackRole,
        isJunk: false,
      });
    }
  }

  return result;
}
