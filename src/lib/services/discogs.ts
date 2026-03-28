const USER_AGENT = "BGMancer/1.0 +https://github.com/talzerr/bgmancer";

function authHeaders(): Record<string, string> {
  const token = process.env.DISCOGS_TOKEN;
  return {
    "User-Agent": USER_AGENT,
    ...(token ? { Authorization: `Discogs token=${token}` } : {}),
  };
}

async function discogsGet(url: string): Promise<{ data: unknown; remaining: number } | null> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    // 404 = genuinely not found — return null so callers can try alternatives
    if (res.status === 404) return null;
    // Everything else is an operational error — surface it
    throw new Error(`Discogs API error: ${res.status} ${url}`);
  }
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

async function tryMasterSearch(gameTitle: string): Promise<DiscogsTracklistResult | null> {
  const searchUrl =
    `https://api.discogs.com/database/search?` +
    `q=${encodeURIComponent(gameTitle)}&genre=Stage+%26+Screen&style=Video+Game+Music` +
    `&type=master&per_page=5`;

  const searchResult = await discogsGet(searchUrl);
  if (!searchResult) return null;
  await throttle(searchResult.remaining);

  const results = (searchResult.data as DiscogsSearchResponse).results ?? [];
  const best = pickByPopularity(results);
  if (!best) return null;

  const masterResult = await discogsGet(`https://api.discogs.com/masters/${best.id}`);
  if (!masterResult) return null;
  await throttle(masterResult.remaining);

  const master = masterResult.data as DiscogsMaster;
  const tracklist = master.tracklist ?? [];
  const tracks = parseTracks(tracklist);
  if (tracks.length === 0) return null;

  return {
    tracks,
    releaseTitle: master.title ?? gameTitle,
    releaseId: best.id,
    sourceType: "discogs-master",
  };
}

// ─── Release search (fallback) ───────────────────────────────────────────────

async function tryReleaseSearch(gameTitle: string): Promise<DiscogsTracklistResult | null> {
  const searchUrl =
    `https://api.discogs.com/database/search?` +
    `q=${encodeURIComponent(gameTitle)}&genre=Stage+%26+Screen&style=Video+Game+Music` +
    `&type=release&per_page=5`;

  const searchResult = await discogsGet(searchUrl);
  if (!searchResult) return null;
  await throttle(searchResult.remaining);

  const results = (searchResult.data as DiscogsSearchResponse).results ?? [];
  const best = pickBestRelease(results);
  if (!best) return null;

  const releaseResult = await discogsGet(`https://api.discogs.com/releases/${best.id}`);
  if (!releaseResult) return null;
  await throttle(releaseResult.remaining);

  const release = releaseResult.data as DiscogsRelease;
  const tracks = parseTracks(release.tracklist ?? []);
  if (tracks.length === 0) return null;

  return {
    tracks,
    releaseTitle: release.title ?? gameTitle,
    releaseId: best.id,
    sourceType: "discogs-release",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type DiscogsTracklistResult = {
  tracks: Array<{ name: string; position: number; durationSeconds: number | null }>;
  releaseTitle: string;
  releaseId: number;
  sourceType: "discogs-master" | "discogs-release";
};

export async function fetchDiscogsRelease(id: number): Promise<DiscogsTracklistResult | null> {
  const result = await discogsGet(`https://api.discogs.com/releases/${id}`);
  if (!result) return null;
  const release = result.data as DiscogsRelease;
  const tracks = parseTracks(release.tracklist ?? []);
  if (tracks.length === 0) return null;
  return {
    tracks,
    releaseTitle: release.title ?? String(id),
    releaseId: id,
    sourceType: "discogs-release",
  };
}

export async function fetchDiscogsMaster(id: number): Promise<DiscogsTracklistResult | null> {
  const result = await discogsGet(`https://api.discogs.com/masters/${id}`);
  if (!result) return null;
  const master = result.data as DiscogsMaster;
  const tracks = parseTracks(master.tracklist ?? []);
  if (tracks.length === 0) return null;
  return {
    tracks,
    releaseTitle: master.title ?? String(id),
    releaseId: id,
    sourceType: "discogs-master",
  };
}

export async function searchGameSoundtrack(
  gameTitle: string,
): Promise<DiscogsTracklistResult | null> {
  return (await tryMasterSearch(gameTitle)) ?? (await tryReleaseSearch(gameTitle));
}
