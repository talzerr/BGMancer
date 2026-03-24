import { getDB } from "@/lib/db";
import { stmt } from "./_shared";
import type { TrackDecision, ArcPhase, SelectionPass } from "@/types";

export const DirectorDecisions = {
  bulkInsert(playlistId: string, decisions: TrackDecision[]): void {
    if (decisions.length === 0) return;
    const db = getDB();
    const insertStmt = stmt(`
      INSERT INTO playlist_track_decisions
        (playlist_id, position, arc_phase, game_id, track_video_id,
         score_role, score_mood, score_inst, score_view_bias, final_score, adjusted_score,
         pool_size, game_budget, game_budget_used, selection_pass, rubric_used, view_bias_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    db.transaction(() => {
      for (const d of decisions) {
        insertStmt.run(
          playlistId,
          d.position,
          d.arcPhase,
          d.gameId,
          d.trackVideoId,
          d.roleScore,
          d.moodScore,
          d.instScore,
          d.viewBiasScore,
          d.finalScore,
          d.adjustedScore,
          d.poolSize,
          d.gameBudget,
          d.gameBudgetUsed,
          d.selectionPass,
          d.rubricUsed ? 1 : 0,
          d.viewBiasActive ? 1 : 0,
        );
      }
    })();
  },

  listByPlaylist(playlistId: string): TrackDecision[] {
    const rows = stmt(`
      SELECT * FROM playlist_track_decisions
      WHERE playlist_id = ?
      ORDER BY position ASC
    `).all(playlistId) as Array<Record<string, unknown>>;

    return rows.map((r) => ({
      position: Number(r.position),
      arcPhase: String(r.arc_phase) as ArcPhase,
      gameId: String(r.game_id),
      trackVideoId: String(r.track_video_id),
      roleScore: Number(r.score_role),
      moodScore: Number(r.score_mood),
      instScore: Number(r.score_inst),
      viewBiasScore: Number(r.score_view_bias),
      finalScore: Number(r.final_score),
      adjustedScore: Number(r.adjusted_score),
      poolSize: Number(r.pool_size),
      gameBudget: Number(r.game_budget),
      gameBudgetUsed: Number(r.game_budget_used),
      selectionPass: String(r.selection_pass) as SelectionPass,
      rubricUsed: !!r.rubric_used,
      viewBiasActive: !!r.view_bias_active,
    }));
  },
};
