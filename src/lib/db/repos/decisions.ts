import { getDB } from "@/lib/db";
import { eq, asc } from "drizzle-orm";
import { playlistTrackDecisions } from "@/lib/db/drizzle-schema";
import type { TrackDecision, ArcPhase, SelectionPass } from "@/types";

export const DirectorDecisions = {
  async bulkInsert(playlistId: string, decisions: TrackDecision[]): Promise<void> {
    if (decisions.length === 0) return;
    getDB().transaction((tx) => {
      for (const d of decisions) {
        tx.insert(playlistTrackDecisions)
          .values({
            playlist_id: playlistId,
            position: d.position,
            arc_phase: d.arcPhase,
            game_id: d.gameId,
            track_video_id: d.trackVideoId,
            score_role: d.roleScore,
            score_mood: d.moodScore,
            score_inst: d.instScore,
            score_view_bias: d.viewBiasScore,
            final_score: d.finalScore,
            adjusted_score: d.adjustedScore,
            pool_size: d.poolSize,
            game_budget: d.gameBudget,
            game_budget_used: d.gameBudgetUsed,
            selection_pass: d.selectionPass,
            rubric_used: d.rubricUsed,
            view_bias_active: d.viewBiasActive,
          })
          .run();
      }
    });
  },

  async listByPlaylist(playlistId: string): Promise<TrackDecision[]> {
    const rows = await getDB()
      .select()
      .from(playlistTrackDecisions)
      .where(eq(playlistTrackDecisions.playlist_id, playlistId))
      .orderBy(asc(playlistTrackDecisions.position))
      .all();

    return rows.map((r) => ({
      position: r.position,
      arcPhase: r.arc_phase as ArcPhase,
      gameId: r.game_id,
      trackVideoId: r.track_video_id,
      roleScore: r.score_role,
      moodScore: r.score_mood,
      instScore: r.score_inst,
      viewBiasScore: r.score_view_bias,
      finalScore: r.final_score,
      adjustedScore: r.adjusted_score,
      poolSize: r.pool_size,
      gameBudget: r.game_budget,
      gameBudgetUsed: r.game_budget_used,
      selectionPass: r.selection_pass as SelectionPass,
      rubricUsed: r.rubric_used,
      viewBiasActive: r.view_bias_active,
    }));
  },
};
