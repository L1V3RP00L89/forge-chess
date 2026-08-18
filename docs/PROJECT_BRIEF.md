# Forge Chess — Project Brief

**Prepared by:** Owen, Product Strategist
**Status:** Draft for team review (Priya, Dara, Renee, Magnus)

---

## Purpose

Forge Chess is a free, browser-native chess analysis and play tool, deployed on GitHub Pages, built on React + TypeScript + Vite with Stockfish 18 (WASM) as the engine. Per the existing design doc (`ANALYSIS_DESIGN.md`), the stated differentiation against Lichess, chess.com, ChessKit, ChessCompass, and OpenChess-Insights is: a best-in-class dark UI, full Stockfish 18 UCI option exposure, annotated PGN import/export, engine arrows, an animated winrate/WDL graph, and offline opening detection — all free and single-page.

With Renee now on the team, purpose sharpens further: this isn't just an engine wrapper — it's meant to genuinely help an **adult improver (roughly 800–2000 rating)** get better, not just display accurate numbers. That's a real product bet, not a given: an engine can be perfectly correct and still teach nothing.

## Outcomes

What "working" looks like, in concrete terms:

1. **A user can play** — human vs human, human vs Stockfish, or AI vs AI — with adjustable difficulty and playback controls, without needing to understand engine internals.
2. **A user can review a game** and come away knowing _what to work on_, not just where their accuracy dropped. This is the outcome most at risk — see Pitfalls.
3. **A user can go from beginner to advanced** inside one tool: Coach mode hides complexity by default; Pro mode exposes MultiPV, WDL, cloud eval, and full UCI controls without the app becoming two products.
4. **The app stays free and installable** — PWA metadata, GitHub Pages hosting, no server costs, no paywall gating depth (the stated gap in chess.com's offering).
5. **The codebase stays shippable** — `npm audit`, lint, tests, and build all pass on every push (already enforced in CI); this outcome protects all the others.

## Milestones

Grounded in what's already shipped (565 commits, spanning 2026-01-29 to 2026-06-01) versus what the team's existing docs (`ANALYSIS_DESIGN.md`, `docs/analysis-tool-design.md`) still call out as open:

| #   | Milestone                                                                                                                                    | State                                                                                                  | Owner                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------- |
| M1  | Core play/analysis/review loop (board, engine worker, PGN/FEN, opening explorer, tablebase, review pass)                                     | **Shipped** — this is the bulk of the 565-commit history                                               | Priya (maintain)     |
| M2  | Mobile/responsive polish (touch targets, dialog layout, panel collapsing)                                                                    | **Ongoing** — most recent commit stream before the gap was mobile-focused `fix:`/`style:` work         | Dara → Priya         |
| M3  | Re-baseline after the dormant period                                                                                                         | **Done** — `npm audit` (0 vulnerabilities), lint, tests (192/192), and build all verified clean as of 2026-08-17 | Priya                |
| M4  | Coach-mode pedagogy pass — audit plain-language guidance against what an adult improver actually needs (plans/patterns over raw eval)        | **Shipped** — staged three-tier Coach reveal, `describeBestMove` gated behind it, journal takeaway count scaled to time control, M8 reveal-event hook wired | Renee → Priya → Dara |
| M5  | Review/accuracy framing pass — reframe critical-moment surfacing around "worth an adult's limited study time" rather than raw centipawn loss | **Shipped** — win-probability-based selection, already-decided suppression, and the time-control-aware cap are live (`src/engine/analysis.ts`) | Renee → Priya        |
| M6  | Opening explorer presentation — thin, memorable repertoire framing vs. theory-dump                                                           | **Not started**                                                                                        | Renee → Dara → Priya |
| M7  | Full-strength engine profile completion (113MB, opt-in, CDN-fetched)                                                                         | **Confirmed working (2026-08-17)** — see note below; description corrected, LFS is not actually in play | Priya                |
| M8  | Training feature — built-in habit-tracking/coaching plan (see below)                                                                         | **In progress** — DB foundation wired in (games recorded on completion/import); post-review journal modal shipped; Training tab, drill queue, and reviewed-game-history view not yet started | Renee → Dara → Priya |
| M9  | Coach/Pro mode logic cleanup — refactor `analysisExperience` branching in `App.tsx`, grown organically across M4/M5                          | **Not started**                                                                                        | Priya                |
| M10 | Top-bar declutter — remove Human vs Human/AI/AI vs AI top-bar controls, New Game becomes sole mode-selection entry point                     | **Not started**                                                                                        | Dara → Priya         |

**M3 close-out**: the repo's last commit before this re-baseline was **2026-06-01**; the gap ran roughly 2.5 months with no activity, raising the risk of silent dependency/API drift. Priya re-ran the full quality gate locally on 2026-08-17 (`npm audit`, `npm run lint`, `npm test -- --run`, `npm run build`) — all clean, nothing broke in the gap. CI should be spot-checked on the next push as a final confirmation, but local re-baseline is complete.

**M7 close-out (2026-08-17)**: the brief's "LFS-aware deploy" framing was stale. `git log` shows a Git LFS approach was tried (`Track stockfish wasm files with Git LFS`, `Convert stockfish wasm files to LFS pointers`) and then abandoned in a repo reset (`chore: clear repository for restart`) — there's no `.gitattributes`, no LFS CLI available, and the deploy workflow has no `lfs: true` checkout step. The actual, working mechanism is different and simpler: the two **lite** profiles (`lite-single-local`, `lite-multi-local`) ship as plain git-tracked binaries in `public/engine/` (verified real WASM, ~7MB each, not truncated), and the two **full** profiles (`full-single-cdn`, `full-multi-cdn`) fetch the ~113MB engine live from `unpkg.com/stockfish@18.0.7` at runtime — never touching git, LFS, or the build output at all. Both CDN URLs were curled directly and return `200` with proper CORS headers. The `coi-serviceworker` COOP/COEP workaround (`public/coi-serviceworker.min.js`, registered in `index.html`) that multi-threaded profiles depend on is present and wired up correctly. **Confirmed functionally working** — no code changes needed, only the milestone description above was corrected to match reality (CDN-fetched, not LFS-based).

## M4 Detail — Coach-Mode Pedagogy Pass

Sourced directly from a real coach's take on 2026-era AI chess tools (`Team Inbox/ChessGoals - 2026 The AI Era.md`, shared by Kris 2026-08-17). Priya audited the current codebase line by line against the article's five principles, with UI implications flagged for Dara — first-pass scope below, awaiting Renee's pushback before implementation starts.

**The five principles, checked against what's actually built:**

1. **Over-analysis is the enemy** — 1–3 takeaways per game (1 for blitz), not paragraphs of AI text between every move.
   Audit: the review pass (`src/engine/analysis.ts`) already reports numeric quality labels and centipawn deltas — no prose anywhere. But nothing caps how many critical moments get surfaced; the Critical Moments list currently shows every flagged move, not the top 1–3. **Real gap.**
2. **Massive courses are bad** — focus and structure over 1000-line theory dumps.
   Audit: no course/theory-content system exists in the app today. This bears on M6 (opening explorer), not M4 — noted for cross-reference, no M4 action.
3. **Engines should guide, not spoon-feed** — the user should work through *why* a move is correct, not just be handed the answer.
   Audit: Coach mode already hides engine-internals chrome (MultiPV, cloud eval, raw UCI, analyze presets), but it still directly displays the engine's best move, its predicted reply, and up to 6 plies of the top line, plus a one-sentence rule-based explanation (`describeBestMove`). That's the opposite of the ask — the answer is visible before the user has reasoned about the position themselves. **This is the main M4 finding.**
4. **Curated human-designed repertoires** beat live theory databases.
   Audit: doesn't exist in the app at all — the opening explorer is a live Lichess/masters database browser, not curated lines. This is M6's job in full; no code overlap with M4.
5. **Active learning** — manually recording your own takeaways beats passively scrolling AI-generated suggestions.
   Audit: the shipped `JournalModal` ("2 things that went well" / "2 things to work on") already matches this closely — manual free-text entry, nothing AI-generated to passively scroll. Likely needs only a copy/framing pass, not structural change.

**M4 scope, concretely (revised after Renee's pushback — see below):**
- Cap Critical Moments to a small default in Coach mode (e.g. 3, dropping to 1 for blitz/bullet time controls) rather than listing every flagged move — Priya. **Blocked on M5**: the selection criteria must be "worth an adult's limited study time," not raw centipawn delta (a blunder in an already-lost position isn't worth surfacing over a small inaccuracy that changed the plan) — M4 and M5 need one shared selection function, not two. Sequence M5's criteria before building this cap.
- Add a **staged, three-tier reveal** in the Coach card, not a single "Show the answer" button: (1) a plan/idea-level hint ("there's a weakness on the back rank"), (2) a square/piece-level hint, (3) the full best move + predicted reply + top line. A binary reveal collapses to "click through it every time" for players below ~1400 who can't yet find the move unaided — staged hints (per Yusupov, the Woodpecker Method) give productive struggle without dead-ending into frustration. Dara owns the interaction pattern (can present as one control, doesn't need three separate buttons visually), Priya the state/logic.
- Gate `describeBestMove`'s one-sentence explanation behind the same reveal, rather than surfacing it alongside a hidden move.
- Scale the **JournalModal** prompt count to match the takeaway cap instead of a hardcoded 2-and-2: 1 positive / 1 improve for blitz/bullet games, 2/2 otherwise. Fixed 2-and-2 regardless of game length directly contradicts the "1 takeaway for blitz" principle this whole pass is built on — Priya, small change.
- Have the reveal interaction (which hint tier was used, "found it"/"missed it") emit a clean event, without wiring it anywhere yet — this is exactly the signal M8's Woodpecker drill queue needs later, and capturing it now avoids a retrofit. Not scope creep to build the consumer, just don't drop the data on the floor — Priya.
- No change to the review pass's underlying analysis/data model — this is a disclosure/presentation pass, not new analysis capability.
- Explicitly out of scope for M4: opening repertoires (M6) and any course/theory content system (not planned).

**Renee's pushback (2026-08-17):** approved with the three changes above folded in — staged reveal instead of binary, cap logic shared with M5 rather than built twice, and journal count scaled to game length. Full review keeps `describeBestMove`'s eventual rewrite (once unblocked) grounded in plans/patterns rather than generic move commentary — flagged for a later content pass once the reveal ships, not blocking this scope.

**Owner sequencing:** M5's critical-moment selection criteria lands first; then Dara builds the staged reveal interaction and the redesigned Critical Moments list; Priya implements the takeaway cap, reveal-state logic, and journal count scaling.

**Shipped (2026-08-17):** the Critical Moments cap was already covered by M5 (`selectCriticalMoments`/`criticalMomentsLimitForTimeControl` apply everywhere, not just Coach mode). The remaining pieces are now live:
- **Staged reveal** — the Coach card's Best move/Reply/Depth grid is replaced with a locked placeholder until the user reveals it, in three tiers: (1) `describeBestMove`'s existing idea-level tags (Capture/Check/Center/Develop/etc.), (2) the best move's destination square only ("Something's worth doing on e4"), (3) the full best move, predicted reply, top line, and the one-sentence summary. One "Show a hint" → "Show more" → "Show the move" control advances tiers per Dara's note that it doesn't need three separate buttons. Pro mode is untouched — `analysisExperience === 'pro'` always renders at full tier, since Pro is an explicit opt-in to engine transparency. Implemented in `App.tsx` (`coachRevealTier` state + `effectiveCoachRevealTier`), styled in `App.css` (`.coach-locked`, `.coach-reveal-*`).
- **M8 hook** — `src/engine/coachEvents.ts` exports `emitCoachRevealEvent`, dispatched on a dedicated `EventTarget` (not `window`, so it stays testable and doesn't leak globally) with `{ fen, bestMoveUci, tier, outcome }`. At tier 3 the user gets "I had this" / "I didn't" buttons that emit `found`/`missed`; if they move on without answering, an `unrated` event fires on cleanup. No consumer wired yet — that's M8's job — but the signal is captured from day one instead of needing a retrofit.
- **Journal scaling** — `journalPromptCountForTimeControl()` (`src/engine/analysis.ts`, shares its blitz/bullet threshold with the Critical Moments cap) drives `JournalModal`'s new `promptCount` prop: 1-and-1 for blitz/bullet games, 2-and-2 otherwise, with the second textarea and its label simply not rendered for `promptCount === 1`. No schema change — the DB layer already treated a blank field as `null`.

Verified visually via a scripted browser walkthrough (Playwright, headless Chromium): Coach mode correctly withholds the answer through all three tiers and Pro mode renders identically to before. Full quality gate (tsc, lint, 207/207 tests, build) clean.

## M5 Detail — Review/Accuracy Framing Pass

Scoped to unblock M4's Critical Moments cap, which needs this milestone's selection criteria rather than duplicating its own. Priya audited the current review pipeline; Renee defines what "worth an adult's limited study time" actually means in terms of the data available.

**What exists today** (`src/App.tsx:1929-1936`, `src/engine/analysis.ts`):
- The Critical Moments list is already curated, not a raw dump — it filters to `inaccuracy`/`mistake`/`blunder`, sorts by **raw centipawn loss** (most cp lost first), and hard-caps at 5.
- No awareness of game phase, material, or whether the position was already decided before the flagged move — a blunder played in a position that was already 95%-winning or 95%-lost gets ranked identically to one in a balanced position.
- Win-probability conversion already exists (`cpToWhiteWinrate`, `src/engine/analysis.ts:426-430`) but is only used for the winrate graph — it's never joined onto review rows. WDL data exists per-position but isn't persisted per move either.
- The Review tab (where Critical Moments lives) is **not gated by Coach/Pro mode** — whatever M5 ships has to work for both audiences, not just one.

**Renee's criteria for "worth studying" (revised after her own pushback — see below):**
- **Rank by win-probability swing, not raw centipawn swing.** A 100cp swing from +200 to +300 barely changes the outcome; the same 100cp swing from +20 to -80 flips the game. Cp-magnitude ranking treats those as identical — that's the core framing bug the article's "worth an adult's limited study time" line is pointing at.
- **Suppress a moment only if win probability stays on the same side before *and* after the move.** Not "before-move win probability was already ≥92%/≤8%" alone — that would suppress a player throwing away a 95%-winning position, which is exactly backwards: conversion technique (holding a won game) is one of the most common, most fixable gaps separating a 1400 from a 1800, and it has to surface, not get hidden. Suppress only when both before- and after-move win probability sit on the same extreme side (still crushing, or still lost) — the moment a move flips which side is practically winning, it's a turning point regardless of how lopsided the position looked beforehand.
- **Compute win probability relative to the side to move, not fixed to White.** The existing `cpToWhiteWinrate` is White-POV; the suppression/ranking logic needs a side-to-move-relative conversion or it breaks asymmetrically for Black. Correctness requirement, not a framing preference.
- **Surface every genuine turning point, dedupe the pile-up.** Don't collapse to "only the first flagged moment" — a game can have more than one real turning point (equal → small edge → the actual decisive blunder later), and "first only" risks showing the minor one and hiding the decisive one. Instead, dedupe consecutive same-severity moments *within* a single already-decided stretch, but let a new moment through whenever win probability re-enters contested range or flips again.
- **Cap tied to time control, not a flat 5 — and treated as a ceiling, not a target.** Replace the hardcoded cap of 5 with the same tiered cap M4 needs (default 3, dropping to 1 for blitz/bullet). If a short or lopsided game only has one real turning point, show one — don't pad the list to hit the cap.

**M5 scope, concretely:**
- Extend the review pipeline to compute win probability (via `cpToWhiteWinrate`, converted to side-to-move-relative) before and after each move, not just `deltaCp` — Priya.
- Replace the Critical Moments sort key with win-probability swing instead of raw `deltaCp` magnitude.
- Add same-side-before-and-after suppression per the corrected rule above (not before-move-only).
- Add turning-point dedupe within already-decided stretches, rather than a blanket "first moment only" cutoff.
- Replace the hardcoded cap-of-5 with a shared, time-control-aware ceiling function — this becomes the function M4's own cap reuses, closing that dependency.
- No UI/visual redesign needed for M5 itself — same Critical Moments card, re-ranked and re-capped. Dara isn't required to scope this pass; only Priya's implementation changes.
- Explicitly out of scope: any change to how individual moves are labeled (`qualityFromDelta`'s best/good/inaccuracy/mistake/blunder buckets stay as-is) — this pass changes *which* moments get surfaced, not how a single move is graded.

**Renee's pushback (2026-08-17):** caught a real bug in the original suppression rule — before-move-only thresholding would have hidden "threw away a winning position" moments, which are exactly the ones worth surfacing most. Fixed by requiring win probability to stay on the same side before *and* after the move, plus a note that win-probability conversion must be side-to-move-relative (correctness issue, not just framing). Also softened "first turning point only" into dedupe-with-reentry, since a game can have more than one genuine turning point. Approved with those changes folded in above.

**Shipped (2026-08-17):** implemented in `src/engine/analysis.ts` — `ReviewRow` now carries `winrateBefore`/`winrateAfter` (White-POV win probability), `selectCriticalMoments()` applies the same-side suppression and pile-up dedupe above, and `criticalMomentsLimitForTimeControl()` reads the PGN `TimeControl` header to pick the ceiling (1 for blitz/bullet, 3 otherwise; unknown/missing time controls default to 3). Wired into `App.tsx`'s Critical Moments panel in place of the old flat top-5-by-raw-cp sort. Covered by new tests in `src/engine/analysis.test.ts`; full quality gate (tsc, lint, 203/203 tests, build) verified clean. This unblocks M4's Critical Moments cap, which reuses `selectCriticalMoments`/`criticalMomentsLimitForTimeControl` directly rather than duplicating the logic.

## M8 Detail — Training Feature

Sourced directly from a real coach-assigned program (ChessGoals' "Intermediate Adult Improver Plan," 12-week structure at 1100–1699 rating, 80/20 playing-to-studying split). Scoped in full through user + Renee + Dara collaboration:

**Structure — built-in template, not a generic configurable system:**

- 12-week cycle with a weekly rotating focus (Woodpecker → Opening Review → Strategy Review → Endgame Review, repeating), mirroring the source plan exactly.
- Each day splits into **Base Work** (daily games, one long game + analysis, alternating with short-game blocks) and **Extra Credit** (slow games, Woodpecker, opening/endgame/strategy review) — a ready-made must-do/bonus tier.
- Checkpoint milestones at week 5, week 7, and week 12, each tied to an actual rating comparison against the plan's start — skill-first, per Renee's mandate, not attendance-first.

**Four concrete sub-features:**

1. **Woodpecker blunder-drill queue** — pulls puzzles from the user's _own_ missed tactics (not a generic set), resurfaced spaced-repetition style until solved reliably. This is the personalization layer that differentiates it from the source plan's generic puzzle sets.
2. **Post-game journal prompt** — **Shipped.** After every review pass, a skippable modal (`src/components/JournalModal.tsx`) asks for two things that went well and two to work on, and writes to `journal_entries` linked back to the `games` row. This operationalizes the source plan's "2 positive / 2 constructive takeaways" ritual, which Renee flagged as the single most valuable habit in the source document. Not yet reviewed by Renee for wording/framing, and there's no UI to look back at saved entries yet — that's part of sub-feature 3.
3. **Training tab** — new top-level nav item, set as the **default landing view** (opens before the board) to reinforce the daily habit. Shows: today's checklist, current week's focus, a visible rating trend graph, a streak counter, and skill-earned badges (e.g. "5 forks spotted in a row," "3 endgames converted clean") with locked badges showing what's needed to unlock — explicitly _not_ activity-farmed (no badges for games played or app opens, streak only counts Base Work completion).
4. **Reviewed game history** — added 2026-08-18 from Kris's backlog (see Future Ideas). No way currently to recall a previously reviewed game; add a persistence/list view so past reviews can be reopened. Additive to the `games`/`journal_entries` tables already written by sub-features 1–2 — no new storage design needed. Owner: Priya.

**Storage:** local-only, consistent with the rest of the app's no-backend approach — implemented as SQLite over OPFS (`src/db/`, worker-backed, wired into `App.tsx` as of the M8 Step 1 DB-wiring pass) rather than localStorage/IndexedDB.

**Owner sequencing:** Renee defines what counts as a "miss" for the drill queue and which badges are skill-meaningful; Dara owns the Training tab layout, journal modal, and full-screen drill-mode visuals (wireframes already sketched in team discussion); Priya implements the data model, drill-queue logic, and UI.

## Pitfalls

Risks worth naming explicitly rather than discovering mid-build:

- **Chess-accurate but pedagogically useless.** The single biggest risk given the app's new purpose: it's easy to ship a feature that's technically correct (right eval, right best move) and still not help anyone improve. Every Coach-mode and review feature should pass through Renee before being considered done, not just through tests.
- **Dormant-branch drift.** 2.5 months since the last commit is enough time for npm audit findings, Stockfish package updates, or the Lichess API to have shifted. Treat the first work session as a re-baseline, not a continuation.
- **113MB engine asset vs. GitHub Pages.** Already identified in the existing design docs: committing the full Stockfish WASM breaks Pages deploys unless handled via CDN opt-in. Any engine-profile work must preserve the lite-by-default, full-as-opt-in split. (An earlier Git LFS approach was tried and abandoned in a repo reset — see M7 note; the current, working mechanism is CDN fetch, not LFS.)
- **Cross-origin isolation fragility.** Multi-threaded WASM needs COOP/COEP headers; GitHub Pages doesn't set these natively, which is why the repo carries `coi-serviceworker`. Any hosting or build change risks silently degrading multi-thread users to single-thread.
- **Scope creep between Coach and Pro modes.** The design doc's own acceptance criterion — "new users can analyze in under 10 seconds without opening settings" — is easy to erode one reasonable-seeming control at a time. Dara should gate new UI surface against this explicitly.
- **Lichess dependency for opening/tablebase depth.** Masters/Lichess opening stats require a session-only user token; tablebase and offline ECO data still work without it. Don't let a feature silently assume the token is present.
- **Gamification drifting into vanity metrics.** Streaks/badges are easy to make addictive and meaningless (games played, days logged in) instead of skill-meaningful. M8 is scoped explicitly against this — streak counts Base Work only, badges are skill-earned — but this is the first place to check if the feature starts feeling hollow.
- **Team synthesis lag.** With five active roles now (Priya, Dara, Renee, plus Owen and Magnus coordinating), the risk shifts from "no one owns this" to "decisions get made in the wrong lane" — e.g., Priya making a UX call Dara should own, or a pedagogy call getting skipped because it looks like a UI tweak. Route through Magnus when ownership is ambiguous.

## Future Ideas / Backlog — Triaged 2026-08-18

Raised by Kris during a 2026-08-16 walkthrough of the app. Six items; below is where each actually lands now that M4/M5/M7 have shipped and M8's DB foundation exists. Two items fold into existing milestones, two become new small standalone milestones (no cross-dependencies, so no reason to block them on M6/M8), one stays unmilestoned pending user input, one is superseded by shipped work.

- **Reviewed game history** → **folds into M8 as a 4th sub-feature.** M8's SQLite-over-OPFS layer already persists `games` and `journal_entries`; a list/reopen view is additive to data that's already being written, not new storage design. Owner: Priya. Sequencing: independent of the drill queue and Training tab — can ship anytime after M8's DB wiring, which is already done.
- **More human, plain-language AI coaching** → **folds into M4**, per Renee's own pushback note on 2026-08-17 ("`describeBestMove`'s eventual rewrite ... grounded in plans/patterns rather than generic move commentary — flagged for a later content pass once the reveal ships"). The reveal shipped 2026-08-17, so this is now unblocked. Owner: Renee (defines the language/framing) → Priya (implements). Not a new milestone number — it's M4's own deferred tail, tracked there.
- **Clean up Coach/Pro mode logic** → **new milestone, M9 (not started).** `analysisExperience` branching in `App.tsx` has grown organically across M4/M5's changes; this is now bigger than "someday" tech debt since two more features have accreted onto it. Standalone — no pedagogy or design input needed, pure refactor. Owner: Priya.
- **Declutter the top bar's game-mode controls** → **new milestone, M10 (not started).** Remove Human vs Human / Human vs AI / AI vs AI as top-bar options; New Game becomes the sole entry point for mode selection. Self-contained UI change, doesn't touch engine/analysis code. Owner: Dara (layout) → Priya (implementation).
- **Engine Lab is unclear** → **stays unmilestoned, needs a scoping decision first.** Before this is a build task it's a question: is Engine Lab something an adult improver (the app's stated audience) needs at all, or is it Pro-only clutter? Renee should answer that before Dara scopes a naming/discoverability pass — could resolve as "rename + explain in-app" or "hide behind Pro mode entirely." Owner: Renee (scope call) → Dara (UX pass, if kept).
- **Chess.com integration** → **stays unmilestoned, blocked on Kris.** Scope is genuinely undefined (game import? live rating pull? something else?) — needs a direct conversation with Kris before George/Priya can even estimate it, let alone schedule it. Not actionable without that.

---

_Next: circulate to Priya, Dara, and Renee for domain-specific pushback before treating milestones as committed._
