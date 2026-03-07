import { NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { fetchPlaylistItems, YouTubeQuotaError } from "@/lib/youtube";
import type { PlaylistTrack } from "@/types";

// Hidden placeholder game used for all imported tracks.
// Filtered out of the normal games list so it doesn't clutter the sidebar.
export const YT_IMPORT_GAME_ID = "__yt_import__";

function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const list = url.searchParams.get("list");
    if (list) return list;
  } catch {
    // Not a URL — treat as raw playlist ID
    if (/^[A-Za-z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * POST /api/playlist/import
 *
 * Imports all tracks from a YouTube playlist by URL or ID.
 * Uses playlistItems.list (1 quota unit) — safe even when search quota is exhausted.
 *
 * Replaces the existing playlist. Tracks are imported as status='found' so they
 * are immediately playable.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const playlistId = extractPlaylistId(body.url ?? "");

    if (!playlistId) {
      return NextResponse.json(
        { error: "Invalid input — paste a YouTube playlist URL or a playlist ID." },
        { status: 400 }
      );
    }

    const tracks = await fetchPlaylistItems(playlistId);

    if (tracks.length === 0) {
      return NextResponse.json(
        { error: "No tracks found. The playlist may be private, empty, or the ID is incorrect." },
        { status: 404 }
      );
    }

    const db = getDB();

    // Ensure the hidden import game exists
    const gameExists = db.prepare("SELECT id FROM games WHERE id = ?").get(YT_IMPORT_GAME_ID);
    if (!gameExists) {
      db.prepare(
        "INSERT INTO games (id, title, vibe_preference, allow_full_ost) VALUES (?, ?, ?, ?)"
      ).run(YT_IMPORT_GAME_ID, "YouTube Import", "official_soundtrack", 0);
    }

    // Replace playlist with imported tracks
    const insertStmt = db.prepare(`
      INSERT INTO playlist_tracks
        (id, game_id, track_name, video_id, video_title, channel_title, thumbnail,
         search_queries, position, status, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'found', NULL)
    `);

    const importAll = db.transaction(() => {
      db.prepare("DELETE FROM playlist_tracks").run();
      for (let i = 0; i < tracks.length; i++) {
        const t = tracks[i];
        insertStmt.run(
          crypto.randomUUID(),
          YT_IMPORT_GAME_ID,
          t.title,
          t.videoId,
          t.title,
          t.channelTitle,
          t.thumbnail,
          i
        );
      }
    });

    importAll();

    const rows = db.prepare(`
      SELECT pt.*, g.title AS game_title
      FROM playlist_tracks pt
      JOIN games g ON g.id = pt.game_id
      ORDER BY pt.position ASC
    `).all() as Record<string, unknown>[];

    const result = rows.map((row) => ({
      ...row,
      search_queries: null,
    })) as PlaylistTrack[];

    return NextResponse.json({
      tracks: result,
      count: result.length,
      playlistId,
    });
  } catch (err) {
    if (err instanceof YouTubeQuotaError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    console.error("[POST /api/playlist/import]", err);
    return NextResponse.json(
      { error: "Import failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
