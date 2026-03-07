import { NextResponse } from "next/server";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { getPool } from "@/lib/db";
import { generateSearchQueries } from "@/lib/llm";
import { findBestVideo } from "@/lib/youtube";
import type { Game } from "@/types";

export async function POST(request: Request) {
  let gameId: string | undefined;

  try {
    const body = await request.json();
    gameId = body.game_id as string;

    if (!gameId) {
      return NextResponse.json({ error: "game_id is required" }, { status: 400 });
    }

    const db = getPool();

    // Fetch the game
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT * FROM games WHERE id = ?",
      [gameId]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "Game not found" }, { status: 404 });
    }

    const game = rows[0] as Game;

    // Cache hit — skip re-searching unless forced
    if (game.current_video_id && game.status === "found" && !body.force_refresh) {
      return NextResponse.json({
        game_id: gameId,
        search_queries: game.search_queries ?? [],
        video_id: game.current_video_id,
        video_title: game.video_title,
        channel_title: game.channel_title,
        video_thumbnail: game.video_thumbnail,
        cached: true,
      });
    }

    // Mark as searching
    await db.query<ResultSetHeader>(
      "UPDATE games SET status = 'searching', error_message = NULL WHERE id = ?",
      [gameId]
    );

    // Ask Gemini for search queries
    const { queries, allowShortVideo } = await generateSearchQueries(
      game.title,
      game.vibe_preference
    );

    // Save queries so the UI can show the "Thinking" section
    await db.query<ResultSetHeader>(
      "UPDATE games SET search_queries = ? WHERE id = ?",
      [JSON.stringify(queries), gameId]
    );

    // Search YouTube
    const video = await findBestVideo(queries, allowShortVideo);

    if (!video) {
      await db.query<ResultSetHeader>(
        `UPDATE games SET status = 'error', error_message = ? WHERE id = ?`,
        [
          "No suitable video found after trying all search queries. Try a different vibe or refresh.",
          gameId,
        ]
      );
      return NextResponse.json(
        { error: "No suitable video found", search_queries: queries },
        { status: 404 }
      );
    }

    // Persist the result
    await db.query<ResultSetHeader>(
      `UPDATE games SET
        status = 'found',
        current_video_id = ?,
        video_title = ?,
        channel_title = ?,
        video_thumbnail = ?,
        search_queries = ?,
        error_message = NULL
       WHERE id = ?`,
      [
        video.videoId,
        video.title,
        video.channelTitle,
        video.thumbnail,
        JSON.stringify(queries),
        gameId,
      ]
    );

    return NextResponse.json({
      game_id: gameId,
      search_queries: queries,
      video_id: video.videoId,
      video_title: video.title,
      channel_title: video.channelTitle,
      video_thumbnail: video.thumbnail,
      cached: false,
    });
  } catch (err) {
    console.error("[POST /api/curator]", err);

    if (gameId) {
      try {
        const db = getPool();
        await db.query<ResultSetHeader>(
          "UPDATE games SET status = 'error', error_message = ? WHERE id = ?",
          [err instanceof Error ? err.message : "Unexpected error", gameId]
        );
      } catch {
        // best-effort
      }
    }

    return NextResponse.json(
      { error: "Curator agent failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
