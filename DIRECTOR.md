# The Director: Architectural Deep Dive

## Abstract

The **Director** is the deterministic orchestration engine at the heart of BGMancer's playlist generation pipeline. It operates entirely without LLM involvement: given a pool of tagged tracks and a set of game library constraints, it assembles a final ordered playlist that adheres to a predefined narrative energy arc while maximizing cross-game diversity and per-track contextual fit. The quality of the output depends entirely on the precision of its internal scoring model — which this document specifies in full.

---

## The Problem With "Shuffle"

Traditional shuffle logic — even weighted shuffle — fails to create immersive listening experiences because it has no concept of **narrative shape**. A gaming session has a rhythm: it starts with exploration, builds tension, peaks during conflict, breathes in quiet moments, and resolves. A random track order violates this structure constantly. The listener never settles into a flow state; instead, they're yanked between moods arbitrarily.

BGMancer's Director solves this by treating playlist assembly as a **constrained optimization problem over a narrative arc** rather than a sampling problem. Every track placement is a deliberate decision, scored against the emotional and sonic requirements of its position in the playlist.

---

## The Heuristic Hierarchy

The Director applies four layers of logic in sequence. Each layer narrows the candidate space or reorders it. Together they ensure both macro-level narrative coherence and micro-level track-to-track feel.

---

### I. The Arc Weaver — Narrative Energy

Before a single track is evaluated, the Director expands a fixed **Arc Template** into a sequence of `ArcSlot` objects — one per position in the final playlist. Each slot encodes the emotional and sonic expectations for that position in the arc.

The arc is divided into six named phases:

| Phase  | Share | Energy   | Emotional Character                              |
| ------ | ----- | -------- | ------------------------------------------------ |
| intro  | 15%   | Low–Mid  | Peaceful, mysterious, nostalgic — world-building |
| rising | 25%   | Mid      | Tense, melancholic, mysterious — stakes rising   |
| peak   | 25%   | Mid–High | Epic, tense, heroic — full engagement            |
| valley | 15%   | Low–Mid  | Serene, peaceful, melancholic — breath           |
| climax | 10%   | High     | Epic, heroic, triumphant, chaotic — catharsis    |
| outro  | 10%   | Low      | Melancholic, nostalgic, peaceful — resolution    |

The shape of that arc, visualized as a relative energy curve across a typical 50-track session:

```
Energy
  3 |                /‾‾‾\                    /‾‾\
    |               /      \                  /    \
  2 |    /‾‾‾‾‾‾‾‾‾/        \              /        \
    |   /                    \            /            \
  1 |__/                      \__________/              \___
    +------------------------------------------------------------→ Position
       Intro      Rising       Peak  Valley  Climax      Outro
      (0–15%)   (15–40%)    (40–65%) (65–80%) (80–90%)  (90–100%)
```

Each phase carries not just energy bounds but **preferred moods**, **penalized moods**, and **preferred instrumentation** — the full emotional fingerprint of what belongs there.

**Energy is a hard gate.** A track with energy `3` (intense) cannot be placed in the intro regardless of how good its mood or instrumentation match is. This prevents the system from rationalizing an obviously wrong placement via high scores on softer dimensions.

---

### II. The Resonance Filter — The Math

Once energy gating passes, the Director scores each candidate track against its target slot using a **Weighted Jaccard Resonance** model across three dimensions: role, mood, and instrumentation.

#### Why Not Additive Scoring?

The original placeholder used additive integer scoring (`score += 5` for a role match). This creates two failure modes:

1. **Tag-Stuffing Vulnerability.** A track tagged with many moods accumulates points for partial matches across multiple dimensions, inflating its score without genuinely fitting the slot. A track tagged `[epic, tense, peaceful, melancholic]` would outscore a cleanly focused `[epic, tense]` track even in a climax slot.

2. **Dimensionless Magnitude.** Additive scores have no natural ceiling, making the penalty multipliers arbitrary. A `−5` penalty means something very different when scores range from `50–60` versus `0–100`.

The Weighted Jaccard model bounds all dimension scores to `[0.0, 1.0]`, making the final resonance score a genuine probability-like measure of fit.

#### The Jaccard Index

For two finite sets $A$ and $B$, the Jaccard similarity coefficient is:

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

A score of `1.0` means the sets are identical. A score of `0.0` means they share no elements. This naturally handles **sparse tags** — a track with only one mood tag is not penalized for not having five; it simply scores based on whether its one tag overlaps with the target set.

#### The Weighted Resonance Formula

The final resonance score $R$ for a track against a slot is:

$$R = w_{\text{role}} \cdot S_{\text{role}} + w_{\text{mood}} \cdot J(\text{moods}_{\text{track}}, \text{moods}_{\text{target}}) + w_{\text{inst}} \cdot J(\text{inst}_{\text{track}}, \text{inst}_{\text{target}})$$

With weights:

| Dimension       | Weight $w$ | Scoring Method     |
| --------------- | ---------- | ------------------ |
| Role            | 0.40       | Binary (1.0 / 0.0) |
| Mood            | 0.35       | Jaccard similarity |
| Instrumentation | 0.25       | Jaccard similarity |

#### Why Role Is Binary, Not Jaccard

Role is not scored with Jaccard even though it could be (each track has a single role, each slot has a preferred role set). The reason is **semantic precision**: a track's role (`Combat`, `Ambient`, `Closer`, etc.) is a categorical classification, not a fuzzy membership. A `Combat` track in an intro slot isn't "somewhat wrong" — it's categorically wrong. Treating it as a partial Jaccard match would introduce an artificial "flexibility penalty" that obscures the distinction between good-fit and bad-fit tracks.

The binary model also means role carries its full `0.40` weight only when it matches. A role mismatch floors that dimension to `0.0` — a strong signal, not a soft nudge.

#### Penalty Multipliers

After the weighted sum, two multiplicative penalties may apply:

**Penalized Mood Penalty** — If any of the track's moods appear in the slot's `penalizedMoods` list (or the rubric's `penalizedMoods`, if present), the score is halved:

$$R' = R \times 0.5 \quad \text{if } \text{moods}_{\text{track}} \cap \text{penalized} \neq \emptyset$$

This is intentionally aggressive. A climax slot penalizes `peaceful` and `playful` because a genuinely peaceful track _does not belong there_, even if its instrumentation happens to match. The penalty does not eliminate the track — it merely ensures it loses to any unpenalized competitor.

**Vocals Penalty** — If the active `ScoringRubric` specifies `allowVocals: false` and the track has vocals, the score is halved again (multiplicatively with the mood penalty if both apply):

$$R'' = R' \times 0.5$$

---

### III. The Scoring Rubric — External Override Layer

The **Scoring Rubric** is an optional parameter passed into `assemblePlaylist` that lets an external caller bend the Director's decisions without rewriting the arc template. It carries six scoring signals: a target energy range, preferred and penalized mood sets, preferred instrumentation, a vocals constraint, and a set of promoted roles. Where present, it interacts with the arc slot defaults through three distinct override modes — not a single merge strategy:

| Field                      | Interaction with Arc Slot                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `preferredMoods`           | **Replaces** `slot.preferredMoods` as the Jaccard target                                          |
| `preferredInstrumentation` | **Replaces** `slot.preferredInstrumentation` as the Jaccard target                                |
| `preferredRoles`           | **Promotes** matching tracks to full role score (`1.0`), even when role isn't in `slot.rolePrefs` |
| `penalizedMoods`           | **Unioned** with `slot.penalizedMoods` — arc penalties always apply, rubric adds to them          |
| `allowVocals`              | **Applies globally** — `null` means no constraint, `false` triggers the 0.5× vocals penalty       |
| `targetEnergy`             | Currently informational — energy gating is still defined by the arc slot                          |

The asymmetry is deliberate. Preference targets (moods, instrumentation) are replaced by the rubric because they represent a global aesthetic intent that should override the arc's generic profile — if the caller specifies a rubric, it knows more about the desired feel than the template does. Penalized moods are unioned rather than replaced because the arc's structural prohibitions (no `chaotic` in outro, no `peaceful` in climax) are safety rails that no external caller should be able to lift.

**The rubric is the integration point for pipeline signals.** It is what allows a future Vibe Check phase, a user preference layer, or any other upstream signal to influence the Director without touching the arc logic. The Director remains fully deterministic given identical inputs — the rubric simply changes what "identical inputs" means.

---

### IV. The Texture Bridge — Transition Smoothing

Resonance scoring determines fitness within a slot. The Texture Bridge layer handles **inter-slot transitions** — specifically, avoiding the jarring effect of hearing the same game's OST twice in a row.

Two rules apply:

1. **Same-Game Avoidance.** The `pickBestTrack` function runs two passes: the first excludes any track from the same game as the previous slot's track. Only if no qualifying candidate survives does it fall back to a relaxed pass that allows same-game placement. This is a soft constraint, not a hard gate.

2. **Diversity Bonus in Game Selection.** When selecting which game's candidate to use for a slot (the outer loop in `assemblePlaylist`), under-represented games — those further below their budget ceiling — receive a small score bonus (`budget_remaining × 0.01`). This biases toward spreading tracks across games proportionally before exhausting any single game's pool.

---

## Mathematical Specification

### Full Scoring Pipeline

For a track $t$ and slot $s$, with optional rubric $\rho$:

**1. Energy Gate**

$$\text{if } t.\text{energy} \notin s.\text{energyPrefs} \Rightarrow R = -\infty \quad \text{(eliminated)}$$

**2. Role Score**

$$S_{\text{role}} = \begin{cases} 1.0 & \text{if } t.\text{role} \in s.\text{rolePrefs} \text{ or } t.\text{role} \in \rho.\text{preferredRoles} \\ 0.0 & \text{otherwise} \end{cases}$$

**3. Mood Score**

$$S_{\text{mood}} = J\!\left(t.\text{moods},\ \rho.\text{preferredMoods} \text{ if } \rho \text{ else } s.\text{preferredMoods}\right)$$

**4. Instrumentation Score**

$$S_{\text{inst}} = J\!\left(t.\text{instrumentation},\ \rho.\text{preferredInstrumentation} \text{ if } \rho \text{ else } s.\text{preferredInstrumentation}\right)$$

The rubric target sets are **exclusive-or**: when $\rho$ is present, it fully replaces the arc slot's preference targets for those dimensions. The two sources are never merged — the rubric either owns the target or it doesn't. This prevents a dilution effect where a general arc preference and a specific rubric preference average each other out into something neither caller intended.

**5. Weighted Sum**

$$R = 0.40 \cdot S_{\text{role}} + 0.35 \cdot S_{\text{mood}} + 0.25 \cdot S_{\text{inst}}$$

**6. Penalty Application**

$$R \leftarrow R \times 0.5 \quad \text{if } t.\text{moods} \cap \text{penalized}(s, \rho) \neq \emptyset$$
$$R \leftarrow R \times 0.5 \quad \text{if } \rho.\text{allowVocals} = \text{false} \text{ and } t.\text{hasVocals} = \text{true}$$

Score range: $R \in [0.0, 1.0]$, reducible to $[0.0, 0.25]$ when both penalties apply.

---

## Top-N Weighted Random Selection

The Director does not greedily pick the single highest-scoring track. Instead, for each slot it collects all energy-gated candidates, sorts by $R$ descending, and takes the top $N$ (currently `DIRECTOR_TOP_N_POOL = 5`). It then performs a **weighted random draw** with probability proportional to $R + \epsilon$ (where $\epsilon = 0.01$ prevents zero-weight exclusion):

$$P(t_i) = \frac{R_i + \epsilon}{\sum_{j=1}^{N} (R_j + \epsilon)}$$

This introduces controlled non-determinism: two generation runs with the same library will produce different playlists, but the score-weighting ensures high-fit tracks appear far more often than low-fit ones. The result feels curated rather than mechanical, without sacrificing the coherence of the arc.

**The pool size $N$ is the primary personality dial.** A small pool (`N = 3`) produces tight, predictable playlists — the Director always picks from a near-optimal shortlist. A large pool (`N = 10`) trades coherence for discovery, letting lower-scored but surprising tracks surface regularly. The current value of `5` sits in the middle: enough randomness that repeated generations feel fresh, not so much that the arc degrades.

---

## Worked Example

**Track:** "The Last of Us Main Theme" (hypothetical tags)

```
energy:          1
role:            Closer
moods:           [melancholic, nostalgic, peaceful]
instrumentation: [acoustic, strings]
hasVocals:       false
```

**Slot:** `outro` phase

```
energyPrefs:              [1]
rolePrefs:                [Closer, Ambient, Menu]
preferredMoods:           [melancholic, nostalgic, peaceful]
penalizedMoods:           [chaotic, tense]
preferredInstrumentation: [piano, acoustic, strings]
```

**Step 1 — Energy Gate:** Energy `1` ∈ `[1]`. Passes.

**Step 2 — Role Score:**
`Closer` ∈ `[Closer, Ambient, Menu]` → $S_{\text{role}} = 1.0$

**Step 3 — Mood Score:**

$$J(\{melancholic, nostalgic, peaceful\}, \{melancholic, nostalgic, peaceful\}) = \frac{3}{3} = 1.0$$

$S_{\text{mood}} = 1.0$

**Step 4 — Instrumentation Score:**

$$J(\{acoustic, strings\}, \{piano, acoustic, strings\}) = \frac{|\{acoustic, strings\}|}{|\{piano, acoustic, strings\}|} = \frac{2}{3} \approx 0.667$$

$S_{\text{inst}} \approx 0.667$

**Step 5 — Weighted Sum:**

$$R = 0.40 \times 1.0 + 0.35 \times 1.0 + 0.25 \times 0.667 = 0.40 + 0.35 + 0.167 = \mathbf{0.917}$$

**Step 6 — Penalties:** No penalized moods present. No vocals. No penalties apply.

**Final Score: $R = 0.917$** — near-perfect fit. This track would dominate the top-N pool for this slot.

---

## Edge Cases

### Zero-Match Fallback

If no candidate passes the energy gate for a slot, the Director escalates through three fallback tiers:

1. **Budget-relaxed pass** — the same energy-gated scoring runs across all games, ignoring budget ceilings. A game that has already hit its allocation can still fill a slot no one else can.
2. **Arc-relaxed pass** — any unused track from any game is accepted regardless of energy or mood, solely to avoid a gap in the playlist.
3. **Gap** — if the pool is genuinely exhausted, the slot is left empty and compacted out of the final result. The playlist is shorter than requested rather than padded with duplicates.

### Single-Game Libraries

When only one game is active, the same-game avoidance pass will always fail (every track is from the same game). The Director falls through to the relaxed pass immediately, which accepts same-game tracks. The arc and resonance scoring still apply in full — the playlist is still shaped, just without cross-game diversity.

### Focus Game Oversubscription

Focus games receive double budget weight and pre-assigned arc slots. If a Focus game's pool is smaller than its computed budget, the Director assigns what's available and does not force duplicates. Remaining slots fall to include/lite games through the normal pass.

---

## Design Philosophy

The Director embodies a specific thesis: **subjective listening experience can be approximated by a small set of well-chosen, weighted heuristics applied consistently.** The goal is not to perfectly score every track — it is to eliminate the worst placements, reward the best ones, and introduce enough controlled randomness that the output feels discovered rather than computed.

The weights (`0.40 / 0.35 / 0.25`) are not derived from first principles — they reflect a deliberate prioritization: _what a track is for_ (role) matters more than _how it feels_ (mood), which matters more than _how it sounds_ (instrumentation). A combat track in a combat slot feels right even if its mood is wrong. A peaceful track in a climax slot feels wrong even if its instrumentation is perfect. The weights encode that hierarchy.

---

## Performance

The scoring pipeline operates in $O(T \cdot S)$ time, where $T$ is the total number of candidate tracks across all active games and $S$ is the number of arc slots (equal to the requested playlist length). Each per-track scoring call is $O(1)$: Jaccard operates on small, fixed-size tag sets (moods cap at 15 values, instrumentation at 15 values), making intersection and union computations constant-time in practice.

On a typical library of 2,000 tagged tracks generating a 50-track playlist, the full `assemblePlaylist` call completes in under 50ms on commodity hardware. The dominant cost in the pipeline is Phase 2 (LLM tagging) — the Director itself is never the bottleneck.
