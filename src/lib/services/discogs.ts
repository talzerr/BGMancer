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
}

interface DiscogsRelease {
  tracklist?: DiscogsTracklistItem[];
}

function pickBestResult(results: DiscogsSearchResult[]): DiscogsSearchResult | null {
  if (results.length === 0) return null;
  const withFile = results.filter((r) => r.format?.includes("File") || r.format?.includes("CD"));
  const pool = withFile.length > 0 ? withFile : results;
  return pool.reduce((best, r) =>
    (r.community?.have ?? 0) > (best.community?.have ?? 0) ? r : best,
  );
}

export async function searchGameSoundtrack(
  gameTitle: string,
): Promise<{ tracks: Array<{ name: string; position: number }>; releaseTitle: string } | null> {
  const searchUrl =
    `https://api.discogs.com/database/search?` +
    `q=${encodeURIComponent(gameTitle)}&genre=Stage+%26+Screen&style=Video+Game+Music` +
    `&type=release&per_page=5`;

  const { data: searchData, remaining: r1 } = await discogsGet(searchUrl);
  if (r1 <= 2) await sleep(61_000);

  const response = searchData as DiscogsSearchResponse;
  const results = response.results ?? [];
  if (results.length === 0) return null;

  const best = pickBestResult(results);
  if (!best) return null;

  const releaseUrl = `https://api.discogs.com/releases/${best.id}`;
  const { data: releaseData, remaining: r2 } = await discogsGet(releaseUrl);
  if (r2 <= 2) await sleep(61_000);

  const release = releaseData as DiscogsRelease & { title?: string };
  const tracklist = release.tracklist ?? [];
  if (tracklist.length === 0) return null;

  const tracks = tracklist
    .filter((t) => t.title?.trim())
    .map((t, i) => ({ name: t.title.trim(), position: i + 1 }));

  if (tracks.length === 0) return null;

  return { tracks, releaseTitle: release.title ?? gameTitle };
}
