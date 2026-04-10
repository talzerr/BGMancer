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

**Energy is a hard gate.** A track with energy 3 (intense) cannot be placed in the intro regardless of how good its mood or instrumentation match is. This prevents the system from rationalizing an obviously wrong placement via high scores on softer dimensions.

---

### II. The Resonance Filter — The Math

Once energy gating passes, the Director scores each candidate track against its target slot using a **Weighted Jaccard Resonance** model across four dimensions: role, mood, view bias, and instrumentation. The first three are tag-based; the fourth introduces a popularity signal derived from YouTube view counts, balancing global reach with per-game cultural weight.

#### Why Not Additive Scoring?

The original placeholder used additive integer scoring (`score += 5` for a role match). This creates two failure modes:

1. **Tag-Stuffing Vulnerability.** A track tagged with many moods accumulates points for partial matches across multiple dimensions, inflating its score without genuinely fitting the slot. A track tagged `[epic, tense, peaceful, melancholic]` would outscore a cleanly focused `[epic, tense]` track even in a climax slot.

2. **Dimensionless Magnitude.** Additive scores have no natural ceiling, making the penalty multipliers arbitrary. A `−5` penalty means something very different when scores range from `50–60` versus `0–100`.

The Weighted Jaccard model bounds all dimension scores to $[0.0, 1.0]$, making the final resonance score a genuine probability-like measure of fit.

#### The Jaccard Index

For two finite sets $A$ and $B$, the Jaccard similarity coefficient is:

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

A score of $1.0$ means the sets are identical. A score of $0.0$ means they share no elements. This naturally handles **sparse tags** — a track with only one mood tag is not penalized for not having five; it simply scores based on whether its one tag overlaps with the target set.

#### The Weighted Resonance Formula

The final resonance score $R$ for a track against a slot is the weighted sum of all active dimensions:

$$R = w_{\text{role}} \cdot S_{\text{role}} + w_{\text{mood}} \cdot S_{\text{mood}} + w_{\text{vb}} \cdot S_{\text{vb}} + w_{\text{inst}} \cdot S_{\text{inst}}$$

The four dimensions are ordered by priority. Role carries the most weight: what a track _is for_ matters more than how it feels. Mood follows: emotional fit is the next most important signal. View bias provides a popularity correction — enough to consistently surface iconic tracks without overriding contextual fit. Instrumentation rounds out the score as a textural tiebreaker.

When the **Raw vibes** toggle is active, the view bias dimension is dropped entirely and the remaining three dimensions absorb its weight, preserving the same relative priority ordering.

The current parameterization:

| Dimension       | $w$ (raw vibes) | $w$ (view bias active) | Scoring Method     |
| --------------- | --------------- | ---------------------- | ------------------ |
| Role            | highest         | high                   | Binary (1.0 / 0.0) |
| Mood            | mid             | mid                    | Jaccard similarity |
| View Bias       | —               | high (= role)          | Log-scaled views   |
| Instrumentation | lowest          | lowest                 | Jaccard similarity |

#### Why Role Is an Intersection Check, Not Jaccard

Tracks carry an array of roles (e.g., `[Combat, Cinematic]`) and slots carry a preferred role set. The scoring is a **pass/fail membership test**: if any of the track's roles overlaps with the slot's preferred roles, the full $1.0$ is awarded. If the intersection is empty, the score is $0.0$.

Jaccard is deliberately avoided here. Jaccard would penalize a track for having _more_ roles than the slot expects — a track tagged `[Combat, Cinematic]` would score lower than a track tagged only `[Combat]` in a Combat slot, even though the multi-role track is at least as good a fit. The intersection check removes this "flexibility penalty" entirely: extra roles never hurt, they only help.

The binary outcome also means role carries its full weight only when any match exists. A role mismatch floors that dimension to $0.0$ — a strong signal, not a soft nudge. Role is a categorical classification, not a fuzzy one: a `Closer` track in a climax slot isn't "somewhat wrong," it's categorically wrong.

#### Penalty Multipliers

After the weighted sum, two multiplicative penalties may apply:

**Penalized Mood Penalty** — If any of the track's moods appear in the slot's `penalizedMoods` list (or the rubric's `penalizedMoods`, if present), the score is halved:

$$R' = R \times \alpha_{\text{mood}} \quad \text{if } \text{moods}_{\text{track}} \cap \text{penalized} \neq \emptyset$$

This is intentionally aggressive. A climax slot penalizes `peaceful` and `playful` because a genuinely peaceful track _does not belong there_, even if its instrumentation happens to match. The penalty does not eliminate the track — it merely ensures it loses to any unpenalized competitor.

**Vocals Penalty** — If the active `ScoringRubric` specifies `allowVocals: false` and the track has vocals, the score is halved again (multiplicatively with the mood penalty if both apply):

$$R'' = R' \times \alpha_{\text{vocals}}$$

Both penalty multipliers $\alpha_{\text{mood}}$ and $\alpha_{\text{vocals}}$ are parameterized. When both apply, the score drops to one quarter of its original value — enough to bury the track in any competitive pool without hard-eliminating it.

#### The View Bias Score — Popularity Dimension

The View Bias Score is the fourth resonance dimension. It blends two sub-signals to solve a fundamental tension in popularity-based scoring: raw view counts favour AAA games categorically, making pure popularity a proxy for budget rather than quality. The solution is to split the signal — one half measures absolute reach, the other measures relative importance within the game's own catalogue.

**Global Heat** — logarithmic scaling of raw view count, normalized to $[0.0, 1.0]$:

$$H = \text{clamp}\left(0, 1, \frac{\log_{10}(\text{views}) - L_{\min}}{L_{\max} - L_{\min}}\right)$$

The lower bound $L_{\min}$ sets the floor: below $10^{L_{\min}}$ views a track has essentially no cultural visibility and scores $0.0$. The upper bound $L_{\max}$ sets the ceiling — beyond it, a track is in "iconic OST theme" territory and there is no meaningful scoring distinction. The logarithm makes the scale perceptually linear: doubling from 500k to 1M views advances the score by the same amount as doubling from 5k to 10k, because both represent the same proportional leap in reach.

**Local Stature** — how essential a track is relative to its own game's average:

$$L = \text{clamp}\left(0, 1, \frac{\text{trackViews} / \text{avgGameViews}}{C_{\text{stature}}}\right)$$

The ceiling $C_{\text{stature}}$ defines what "standout" means at the catalogue level: a track at $C_{\text{stature}}\times$ its game's average scores $1.0$, treated as maximally important within that catalogue. Below that threshold the score scales linearly. The choice reflects what "standout" means: a track that gets several multiples of the average views is clearly the one people actively seek out, not just a track they happened to listen to.

**Combined:**

$$S_{\text{vb}} = w_H \cdot H + w_L \cdot L$$

where $w_H$ and $w_L$ are the global heat and local stature blend weights respectively ($w_H + w_L = 1$). The split gives global reach the majority influence while reserving meaningful weight for per-game significance.

Tracks with no view data receive a **baseline** score — not penalized to zero, but naturally outscored by tracks with real popularity signal.

View bias scores are pre-computed once per playlist assembly — not on a per-slot basis — because the per-game average required for Local Stature must be computed across the entire pool before any slot is filled.

---

### III. The Scoring Rubric — External Override Layer

The **Scoring Rubric** is an optional parameter passed into the assembly function that lets an external caller bend the Director's decisions without rewriting the arc template. It carries six scoring signals: a target energy range, preferred and penalized mood sets, preferred instrumentation, a vocals constraint, and a set of promoted roles. Where present, it interacts with the arc slot defaults through three distinct override modes — not a single merge strategy:

| Field                      | Interaction with Arc Slot                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| `preferredMoods`           | **Replaces** `slot.preferredMoods` as the Jaccard target                                          |
| `preferredInstrumentation` | **Replaces** `slot.preferredInstrumentation` as the Jaccard target                                |
| `preferredRoles`           | **Promotes** matching tracks to full role score ($1.0$), even when role isn't in `slot.rolePrefs` |
| `penalizedMoods`           | **Unioned** with `slot.penalizedMoods` — arc penalties always apply, rubric adds to them          |
| `allowVocals`              | **Applies globally** — `null` means no constraint, `false` triggers the vocals penalty            |
| `targetEnergy`             | Currently informational — energy gating is still defined by the arc slot                          |

The asymmetry is deliberate. Preference targets (moods, instrumentation) are replaced by the rubric because they represent a global aesthetic intent that should override the arc's generic profile — if the caller specifies a rubric, it knows more about the desired feel than the template does. Penalized moods are unioned rather than replaced because the arc's structural prohibitions (no `chaotic` in outro, no `peaceful` in climax) are safety rails that no external caller should be able to lift.

**The rubric is the integration point for pipeline signals.** It is what allows a future Vibe Check phase, a user preference layer, or any other upstream signal to influence the Director without touching the arc logic. The Director remains fully deterministic given identical inputs — the rubric simply changes what "identical inputs" means.

---

### IV. The Texture Bridge — Transition Smoothing

Resonance scoring determines fitness within a slot. The Texture Bridge layer handles **inter-slot transitions** — specifically, avoiding the jarring effect of hearing the same game's OST twice in a row.

Two mechanisms apply:

1. **Same-Game Score Penalty.** When the selection loop compares each game's best candidate for a slot, any candidate from the same game as the previous slot's track receives a score penalty $\delta_{\text{same}}$. This makes same-game placement less likely to win the cross-game comparison. The penalty is small relative to the score range — a tiebreaker, not a veto. A game with significantly higher-scoring tracks can still win despite the penalty.

2. **Deficit-Based Diversity Bonus.** Under-represented games receive a score bonus proportional to how far behind they are relative to their expected fill rate at the current point in assembly. Let $b$ be a game's budget, $u$ its current usage, $i$ the current slot index, and $n$ the total playlist length. The expected usage at position $i$ is $b \cdot (i / n)$. The deficit is:

$$d = \frac{b \cdot (i / n) - u}{b}$$

The diversity bonus is $\max(0, d) \times \gamma$, where $\gamma$ is the diversity scale parameter. A game running ahead of its expected fill rate ($d \leq 0$) receives no bonus. A game that is behind receives a boost that grows with both the magnitude of underrepresentation and assembly progress — the same absolute deficit produces a larger normalized deficit later in the playlist, when underrepresentation is a genuine problem rather than natural early variance. The scale parameter $\gamma$ is calibrated to produce bonuses in the same order of magnitude as typical resonance score gaps, making diversity competitive with — but not dominant over — track-to-slot fit.

Additionally, a small random jitter $\epsilon_{\text{jitter}}$ is added to each candidate's score to break ties between equally-scored candidates from different games, preventing deterministic ordering artifacts.

---

## Mathematical Specification

### Full Scoring Pipeline

For a track $t$ and slot $s$, with optional rubric $\rho$:

**1. Energy Gate**

$$\text{if } t.\text{energy} \notin s.\text{energyPrefs} \Rightarrow R = -\infty \quad \text{(eliminated)}$$

**2. Role Score**

$$S_{\text{role}} = \begin{cases} 1.0 & \text{if } t.\text{roles} \cap s.\text{rolePrefs} \neq \emptyset \text{ or } t.\text{roles} \cap \rho.\text{preferredRoles} \neq \emptyset \\ 0.0 & \text{otherwise} \end{cases}$$

**3. Mood Score**

$$S_{\text{mood}} = J\!\left(t.\text{moods},\ \rho.\text{preferredMoods} \text{ if } \rho \text{ else } s.\text{preferredMoods}\right)$$

**4. Instrumentation Score**

$$S_{\text{inst}} = J\!\left(t.\text{instrumentation},\ \rho.\text{preferredInstrumentation} \text{ if } \rho \text{ else } s.\text{preferredInstrumentation}\right)$$

The rubric target sets are **exclusive-or**: when $\rho$ is present, it fully replaces the arc slot's preference targets for those dimensions. The two sources are never merged — the rubric either owns the target or it doesn't. This prevents a dilution effect where a general arc preference and a specific rubric preference average each other out into something neither caller intended.

**5. View Bias Score**

$$S_{\text{vb}} = w_H \cdot \text{clamp}\!\left(0, 1, \frac{\log_{10}(\text{views}) - L_{\min}}{L_{\max} - L_{\min}}\right) + w_L \cdot \text{clamp}\!\left(0, 1, \frac{\text{trackViews} / \text{avgGameViews}}{C_{\text{stature}}}\right)$$

**6. Weighted Sum**

$$R = w_{\text{role}} \cdot S_{\text{role}} + w_{\text{mood}} \cdot S_{\text{mood}} + w_{\text{vb}} \cdot S_{\text{vb}} + w_{\text{inst}} \cdot S_{\text{inst}}$$

**7. Penalty Application**

$$R \leftarrow R \times \alpha_{\text{mood}} \quad \text{if } t.\text{moods} \cap \text{penalized}(s, \rho) \neq \emptyset$$
$$R \leftarrow R \times \alpha_{\text{vocals}} \quad \text{if } \rho.\text{allowVocals} = \text{false} \text{ and } t.\text{hasVocals} = \text{true}$$

Score range: $R \in [0.0, 1.0]$, reducible to $[0.0, \alpha_{\text{mood}} \cdot \alpha_{\text{vocals}}]$ when both penalties apply.

**8. Assembly-Time Adjustments**

When comparing candidates across games for a given slot during assembly (not during isolated scoring), three adjustments apply to the penalized score $R$:

$$R \leftarrow R - \delta_{\text{same}} \quad \text{if game} = \text{lastGame}$$

$$R \leftarrow R + \max\!\left(0,\ \frac{b \cdot (i/n) - u}{b}\right) \times \gamma \quad \text{(diversity bonus)}$$

$$R \leftarrow R + \text{Uniform}(0, \epsilon_{\text{jitter}}) \quad \text{(tie-breaking)}$$

where $b$ is the game's budget, $u$ its current usage, $i$ the slot index, $n$ the playlist length, $\gamma$ the diversity scale, and $\delta_{\text{same}}$ the same-game penalty. These adjustments operate on the cross-game comparison, not on the per-track resonance score.

---

## Top-N Weighted Random Selection

The Director does not greedily pick the single highest-scoring track. Instead, for each slot it collects all energy-gated candidates, sorts by $R$ descending, and takes the top $N$. It then performs a **weighted random draw** with probability proportional to $R + \epsilon$ (where $\epsilon$ is a small constant preventing zero-weight exclusion):

$$P(t_i) = \frac{R_i + \epsilon}{\sum_{j=1}^{N} (R_j + \epsilon)}$$

This introduces controlled non-determinism: two generation runs with the same library will produce different playlists, but the score-weighting ensures high-fit tracks appear far more often than low-fit ones. The result feels curated rather than mechanical, without sacrificing the coherence of the arc.

**The pool size $N$ is the primary personality dial.** A small pool produces tight, predictable playlists — the Director always picks from a near-optimal shortlist. A large pool trades coherence for discovery, letting lower-scored but surprising tracks surface regularly. The current value sits in the middle: enough randomness that repeated generations feel fresh, not so much that the arc degrades.

---

## Worked Example

_Using the default parameterization at time of writing._

**Track:** "The Last of Us Main Theme" (hypothetical tags)

```
energy:          1
roles:           [Closer, Ambient]
moods:           [melancholic, nostalgic, peaceful]
instrumentation: [acoustic, strings]
hasVocals:       false
viewCount:       2,000,000
avgGameViews:    500,000
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
$\{Closer, Ambient\} \cap \{Closer, Ambient, Menu\} = \{Closer, Ambient\} \neq \emptyset$ → $S_{\text{role}} = 1.0$

**Step 3 — Mood Score:**

$$J(\{melancholic, nostalgic, peaceful\}, \{melancholic, nostalgic, peaceful\}) = \frac{3}{3} = 1.0$$

$S_{\text{mood}} = 1.0$

**Step 4 — Instrumentation Score:**

$$J(\{acoustic, strings\}, \{piano, acoustic, strings\}) = \frac{|\{acoustic, strings\}|}{|\{piano, acoustic, strings\}|} = \frac{2}{3} \approx 0.667$$

$S_{\text{inst}} \approx 0.667$

**Step 5 — View Bias Score:**

$$H = \text{clamp}\left(0, 1, \frac{\log_{10}(2{,}000{,}000) - L_{\min}}{L_{\max} - L_{\min}}\right) = \frac{6.30 - 3}{4} \approx 0.825$$

$$L = \text{clamp}\left(0, 1, \frac{2{,}000{,}000\ /\ 500{,}000}{C_{\text{stature}}}\right) = \text{clamp}\left(0, 1, \frac{4.0}{3}\right) = 1.0$$

The track is at $4\times$ its game's average — above the stature ceiling — so Local Stature clamps to $1.0$.

$$S_{\text{vb}} = w_H \times 0.825 + w_L \times 1.0 = 0.495 + 0.400 = 0.895$$

**Step 6 — Weighted Sum:**

$$R = w_{\text{role}} \times 1.0 + w_{\text{mood}} \times 1.0 + w_{\text{vb}} \times 0.895 + w_{\text{inst}} \times 0.667$$
$$= 0.300 + 0.250 + 0.269 + 0.100 = 0.919$$

**Step 7 — Penalties:** No penalized moods present. No vocals. No penalties apply.

**Final Score: $R = 0.919$** — near-perfect fit. This track would dominate the top-N pool for this slot.

_Note: the assembly-time adjustments (same-game penalty, diversity bonus, jitter) apply during cross-game comparison, not shown in this single-track evaluation._

---

## Edge Cases

### Zero-Match Fallback

If no candidate passes the energy gate for a slot, the Director escalates through three fallback tiers:

1. **Budget-relaxed pass** — the same energy-gated scoring runs across all games, ignoring budget ceilings. A game that has already hit its allocation can still fill a slot no one else can.
2. **Arc-relaxed pass** — any unused track from any game is accepted regardless of energy or mood, solely to avoid a gap in the playlist.
3. **Gap** — if the pool is genuinely exhausted, the slot is left empty and compacted out of the final result. The playlist is shorter than requested rather than padded with duplicates.

### Single-Game Libraries

When only one game is active, the same-game penalty and diversity bonus have no effect (there is no cross-game competition). The arc and resonance scoring still apply in full — the playlist is still shaped, just without cross-game diversity.

### Focus Game Oversubscription

Focus games receive double budget weight and pre-assigned arc slots. If a Focus game's pool is smaller than its computed budget, the Director assigns what's available and does not force duplicates. Remaining slots fall to include/lite games through the normal pass.

---

## Design Philosophy

The Director embodies a specific thesis: **subjective listening experience can be approximated by a small set of well-chosen, weighted heuristics applied consistently.** The goal is not to perfectly score every track — it is to eliminate the worst placements, reward the best ones, and introduce enough controlled randomness that the output feels discovered rather than computed.

The weights encode a deliberate priority hierarchy: _what a track is for_ (role) matters more than _how it feels_ (mood), which matters more than _how it sounds_ (instrumentation). A combat track in a combat slot feels right even if its mood is wrong. A peaceful track in a climax slot feels wrong even if its instrumentation is perfect.

With view bias active, popularity sits at the same level as role — significant enough to consistently surface iconic tracks, but role and mood together still dominate. A well-matched obscure track will often beat a massively popular but misfit one.

---

## Performance

The scoring pipeline operates in $O(T \cdot S)$ time, where $T$ is the total number of candidate tracks across all active games and $S$ is the number of arc slots (equal to the requested playlist length). Each per-track scoring call is $O(1)$: Jaccard operates on small, fixed-size tag sets (moods and instrumentation each cap at a bounded number of values), making intersection and union computations constant-time in practice.

On a typical library of several thousand tagged tracks generating a 50-track playlist, the full assembly completes in under 50ms on commodity hardware. The dominant cost in the pipeline is the LLM tagging phase — the Director itself is never the bottleneck.
