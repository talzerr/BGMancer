const USER_AGENT = "BGMancer/1.0 +https://github.com/talzerr/bgmancer";

function authHeaders(): Record<string, string> {
  const token = process.env.DISCOGS_TOKEN;
  return {
    "User-Agent": USER_AGENT,
    ...(token ? { Authorization: `Discogs token=${token}` } : {}),
  };
}

async function discogsGet(url: string): Promise<{ data: unknown; remaining: number }> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Discogs request failed: ${res.status} ${url}`);
  const remaining = Number(res.headers.get("X-Discogs-Ratelimit-Remaining") ?? "99");
  const data = await res.json();
  return { data, remaining };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttle(remaining: number): Promise<void> {
  if (remaining <= 2) await sleep(61_000);
}

interface DiscogsSearchResult {
  id: number;
  format?: string[];
  community?: { have: number };
}

interface DiscogsSearchResponse {
  results?: DiscogsSearchResult[];
}

interface DiscogsTracklistItem {
  title: string;
  position: string;
  duration?: string;
}

interface DiscogsRelease {
  tracklist?: DiscogsTracklistItem[];
  title?: string;
}

interface DiscogsMaster extends DiscogsRelease {
  main_release?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickByPopularity(results: DiscogsSearchResult[]): DiscogsSearchResult | null {
  if (results.length === 0) return null;
  return results.reduce((best, r) =>
    (r.community?.have ?? 0) > (best.community?.have ?? 0) ? r : best,
  );
}

function pickBestRelease(results: DiscogsSearchResult[]): DiscogsSearchResult | null {
  if (results.length === 0) return null;
  // Prefer digital/CD over vinyl for completeness of tracklist
  const withFile = results.filter((r) => r.format?.includes("File") || r.format?.includes("CD"));
  const pool = withFile.length > 0 ? withFile : results;
  return pickByPopularity(pool);
}

function parseDuration(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw.split(":").map(Number);
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return null;
}

function parseTracks(
  tracklist: DiscogsTracklistItem[],
): Array<{ name: string; position: number; durationSeconds: number | null }> {
  return tracklist
    .filter((t) => t.title?.trim())
    .map((t, i) => ({
      name: t.title.trim(),
      position: i + 1,
      durationSeconds: parseDuration(t.duration),
    }));
}

// ─── Master search (preferred) ───────────────────────────────────────────────

async function tryMasterSearch(gameTitle: string): Promise<{
  tracks: Array<{ name: string; position: number; durationSeconds: number | null }>;
  releaseTitle: string;
  releaseId: number;
} | null> {
  const searchUrl =
    `https://api.discogs.com/database/search?` +
    `q=${encodeURIComponent(gameTitle)}&genre=Stage+%26+Screen&style=Video+Game+Music` +
    `&type=master&per_page=5`;

  const { data: searchData, remaining: r1 } = await discogsGet(searchUrl);
  await throttle(r1);

  const results = (searchData as DiscogsSearchResponse).results ?? [];
  const best = pickByPopularity(results);
  if (!best) return null;

  const { data: masterData, remaining: r2 } = await discogsGet(
    `https://api.discogs.com/masters/${best.id}`,
  );
  await throttle(r2);

  const master = masterData as DiscogsMaster;
  const tracklist = master.tracklist ?? [];
  const tracks = parseTracks(tracklist);
  if (tracks.length === 0) return null;

  // Use master ID as the canonical identifier (prefixed so it's distinguishable from release IDs)
  return { tracks, releaseTitle: master.title ?? gameTitle, releaseId: best.id };
}

// ─── Release search (fallback) ───────────────────────────────────────────────

async function tryReleaseSearch(gameTitle: string): Promise<{
  tracks: Array<{ name: string; position: number; durationSeconds: number | null }>;
  releaseTitle: string;
  releaseId: number;
} | null> {
  const searchUrl =
    `https://api.discogs.com/database/search?` +
    `q=${encodeURIComponent(gameTitle)}&genre=Stage+%26+Screen&style=Video+Game+Music` +
    `&type=release&per_page=5`;

  const { data: searchData, remaining: r1 } = await discogsGet(searchUrl);
  await throttle(r1);

  const results = (searchData as DiscogsSearchResponse).results ?? [];
  const best = pickBestRelease(results);
  if (!best) return null;

  const { data: releaseData, remaining: r2 } = await discogsGet(
    `https://api.discogs.com/releases/${best.id}`,
  );
  await throttle(r2);

  const release = releaseData as DiscogsRelease;
  const tracks = parseTracks(release.tracklist ?? []);
  if (tracks.length === 0) return null;

  return { tracks, releaseTitle: release.title ?? gameTitle, releaseId: best.id };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function searchGameSoundtrack(gameTitle: string): Promise<{
  tracks: Array<{ name: string; position: number; durationSeconds: number | null }>;
  releaseTitle: string;
  releaseId: number;
} | null> {
  const result = (await tryMasterSearch(gameTitle)) ?? (await tryReleaseSearch(gameTitle));
  if (result) return result;

  // TODO: this is a hack — strip subtitle/edition suffix and retry (e.g. "Foo – Definitive Edition" → "Foo").
  // Ideally we'd resolve a canonical OST title via IGDB or similar before ever hitting Discogs.
  const truncated = gameTitle.split(/\s[–-]\s/)[0].trim();
  if (truncated === gameTitle) return null;
  return (await tryMasterSearch(truncated)) ?? (await tryReleaseSearch(truncated));
}
