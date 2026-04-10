// ─── Resonance scoring weights (raw vibes mode — no view bias) ──────────────

/** Dimension weight for role match (binary: 1.0 if match, 0.0 if not). */
export const SCORE_WEIGHT_ROLE = 0.4;

/** Dimension weight for mood Jaccard similarity. */
export const SCORE_WEIGHT_MOOD = 0.35;

/** Dimension weight for instrumentation Jaccard similarity. */
export const SCORE_WEIGHT_INSTRUMENT = 0.25;

// ─── Resonance scoring weights (view bias mode) ─────────────────────────────

/** Dimension weight for role match when view bias scoring is active. */
export const SCORE_WEIGHT_ROLE_VIEW_BIAS = 0.3;

/** Dimension weight for mood Jaccard similarity when view bias scoring is active. */
export const SCORE_WEIGHT_MOOD_VIEW_BIAS = 0.25;

/** Dimension weight for the view bias score when view bias scoring is active. */
export const SCORE_WEIGHT_VIEW_BIAS = 0.3;

/** Dimension weight for instrumentation Jaccard similarity when view bias scoring is active. */
export const SCORE_WEIGHT_INSTRUMENT_VIEW_BIAS = 0.15;

// ─── Penalty multipliers ─────────────────────────────────────────────────────

/** Multiplier applied when a track contains a penalized mood. */
export const SCORE_PENALTY_MULTIPLIER = 0.5;

/** Multiplier applied when rubric.allowVocals is false and track has vocals. */
export const SCORE_VOCALS_PENALTY_MULTIPLIER = 0.5;

// ─── View bias scoring ───────────────────────────────────────────────────────

/** Baseline view bias score for tracks with no YouTube view data. */
export const VIEW_BIAS_SCORE_BASELINE = 0.3;

/** Lower bound of log10 view count for view bias normalization (log10(1,000)). */
export const VIEW_BIAS_LOG_MIN = 3;

/** Upper bound of log10 view count for view bias normalization (log10(10,000,000)). */
export const VIEW_BIAS_LOG_MAX = 7;

/** Weight of global heat (log-scaled views) in the combined view bias score. */
export const VIEW_BIAS_GLOBAL_HEAT_WEIGHT = 0.6;

/** Weight of local stature (per-game relative views) in the combined view bias score. */
export const VIEW_BIAS_LOCAL_STATURE_WEIGHT = 0.4;

/** Ceiling for local stature — a track at N× its game's average scores 1.0. */
export const VIEW_BIAS_LOCAL_STATURE_CEILING = 3;

// ─── Top-N selection ─────────────────────────────────────────────────────────

/** Number of top candidates for weighted random selection per slot. */
export const DIRECTOR_TOP_N_POOL = 5;

/** Epsilon added to scores in weighted random draw to prevent zero-weight exclusion. */
export const WEIGHTED_RANDOM_EPSILON = 0.01;

// ─── Game diversity ──────────────────────────────────────────────────────────

/** Score penalty when selecting a track from the same game as the previous slot. */
export const SAME_GAME_PENALTY = 0.05;

/** Scale factor for deficit-based diversity bonus. At 0.20, a game that is
 *  one full budget cycle behind its expected fill rate receives a bonus
 *  comparable to typical resonance score gaps (0.15–0.25). */
export const DIVERSITY_BONUS_SCALE = 0.2;

/** Random jitter added to scores for tie-breaking between equally-scored candidates. */
export const SCORE_JITTER_MAX = 0.005;

// ─── Game budgets ────────────────────────────────────────────────────────────

/** Budget weight for Focus curation mode (2× standard). */
export const BUDGET_WEIGHT_FOCUS = 2;

/** Budget weight for Lite curation mode (0.5× standard). */
export const BUDGET_WEIGHT_LITE = 0.5;

/** Budget weight for Include curation mode (standard). */
export const BUDGET_WEIGHT_INCLUDE = 1;

/** Soft cap: max fraction of playlist any single game can occupy. */
export const BUDGET_SOFT_CAP_FRACTION = 0.4;
