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
| M4  | Coach-mode pedagogy pass — audit plain-language guidance against what an adult improver actually needs (plans/patterns over raw eval)        | **Scoped** — see M4 Detail below; awaiting Renee/user pushback before implementation                    | Renee → Priya → Dara |
| M5  | Review/accuracy framing pass — reframe critical-moment surfacing around "worth an adult's limited study time" rather than raw centipawn loss | **Not started**                                                                                        | Renee → Priya        |
| M6  | Opening explorer presentation — thin, memorable repertoire framing vs. theory-dump                                                           | **Not started**                                                                                        | Renee → Dara → Priya |
| M7  | Full-strength CDN engine profile completion (113MB builds, opt-in, LFS-aware deploy)                                                         | **Partially shipped** — commit history shows LFS/CDN work already done; confirm it's still functioning | Priya                |
| M8  | Training feature — built-in habit-tracking/coaching plan (see below)                                                                         | **In progress** — DB foundation wired in (games recorded on completion/import); post-review journal modal shipped; Training tab and drill queue not yet started | Renee → Dara → Priya |

**M3 close-out**: the repo's last commit before this re-baseline was **2026-06-01**; the gap ran roughly 2.5 months with no activity, raising the risk of silent dependency/API drift. Priya re-ran the full quality gate locally on 2026-08-17 (`npm audit`, `npm run lint`, `npm test -- --run`, `npm run build`) — all clean, nothing broke in the gap. CI should be spot-checked on the next push as a final confirmation, but local re-baseline is complete.

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

## M8 Detail — Training Feature

Sourced directly from a real coach-assigned program (ChessGoals' "Intermediate Adult Improver Plan," 12-week structure at 1100–1699 rating, 80/20 playing-to-studying split). Scoped in full through user + Renee + Dara collaboration:

**Structure — built-in template, not a generic configurable system:**

- 12-week cycle with a weekly rotating focus (Woodpecker → Opening Review → Strategy Review → Endgame Review, repeating), mirroring the source plan exactly.
- Each day splits into **Base Work** (daily games, one long game + analysis, alternating with short-game blocks) and **Extra Credit** (slow games, Woodpecker, opening/endgame/strategy review) — a ready-made must-do/bonus tier.
- Checkpoint milestones at week 5, week 7, and week 12, each tied to an actual rating comparison against the plan's start — skill-first, per Renee's mandate, not attendance-first.

**Three concrete sub-features:**

1. **Woodpecker blunder-drill queue** — pulls puzzles from the user's _own_ missed tactics (not a generic set), resurfaced spaced-repetition style until solved reliably. This is the personalization layer that differentiates it from the source plan's generic puzzle sets.
2. **Post-game journal prompt** — **Shipped.** After every review pass, a skippable modal (`src/components/JournalModal.tsx`) asks for two things that went well and two to work on, and writes to `journal_entries` linked back to the `games` row. This operationalizes the source plan's "2 positive / 2 constructive takeaways" ritual, which Renee flagged as the single most valuable habit in the source document. Not yet reviewed by Renee for wording/framing, and there's no UI to look back at saved entries yet — that's part of sub-feature 3.
3. **Training tab** — new top-level nav item, set as the **default landing view** (opens before the board) to reinforce the daily habit. Shows: today's checklist, current week's focus, a visible rating trend graph, a streak counter, and skill-earned badges (e.g. "5 forks spotted in a row," "3 endgames converted clean") with locked badges showing what's needed to unlock — explicitly _not_ activity-farmed (no badges for games played or app opens, streak only counts Base Work completion).

**Storage:** local-only, consistent with the rest of the app's no-backend approach — implemented as SQLite over OPFS (`src/db/`, worker-backed, wired into `App.tsx` as of the M8 Step 1 DB-wiring pass) rather than localStorage/IndexedDB.

**Owner sequencing:** Renee defines what counts as a "miss" for the drill queue and which badges are skill-meaningful; Dara owns the Training tab layout, journal modal, and full-screen drill-mode visuals (wireframes already sketched in team discussion); Priya implements the data model, drill-queue logic, and UI.

## Pitfalls

Risks worth naming explicitly rather than discovering mid-build:

- **Chess-accurate but pedagogically useless.** The single biggest risk given the app's new purpose: it's easy to ship a feature that's technically correct (right eval, right best move) and still not help anyone improve. Every Coach-mode and review feature should pass through Renee before being considered done, not just through tests.
- **Dormant-branch drift.** 2.5 months since the last commit is enough time for npm audit findings, Stockfish package updates, or the Lichess API to have shifted. Treat the first work session as a re-baseline, not a continuation.
- **113MB engine asset vs. GitHub Pages.** Already identified in the existing design docs: committing the full Stockfish WASM breaks Pages deploys unless handled via LFS/CDN opt-in. Any engine-profile work must preserve the lite-by-default, full-as-opt-in split.
- **Cross-origin isolation fragility.** Multi-threaded WASM needs COOP/COEP headers; GitHub Pages doesn't set these natively, which is why the repo carries `coi-serviceworker`. Any hosting or build change risks silently degrading multi-thread users to single-thread.
- **Scope creep between Coach and Pro modes.** The design doc's own acceptance criterion — "new users can analyze in under 10 seconds without opening settings" — is easy to erode one reasonable-seeming control at a time. Dara should gate new UI surface against this explicitly.
- **Lichess dependency for opening/tablebase depth.** Masters/Lichess opening stats require a session-only user token; tablebase and offline ECO data still work without it. Don't let a feature silently assume the token is present.
- **Gamification drifting into vanity metrics.** Streaks/badges are easy to make addictive and meaningless (games played, days logged in) instead of skill-meaningful. M8 is scoped explicitly against this — streak counts Base Work only, badges are skill-earned — but this is the first place to check if the feature starts feeling hollow.
- **Team synthesis lag.** With five active roles now (Priya, Dara, Renee, plus Owen and Magnus coordinating), the risk shifts from "no one owns this" to "decisions get made in the wrong lane" — e.g., Priya making a UX call Dara should own, or a pedagogy call getting skipped because it looks like a UI tweak. Route through Magnus when ownership is ambiguous.

## Future Ideas / Backlog

Raised by Kris during a 2026-08-16 walkthrough of the app. Not scoped or milestoned yet — captured here so they aren't lost, for Owen to triage into milestones when there's room.

- **Chess.com integration.** Unspecified scope — could mean importing chess.com game history, pulling live ratings, or something else. Needs a follow-up conversation with Kris before George/Priya estimate it.
- **Clean up Coach/Pro mode logic.** `analysisExperience` branching in `App.tsx` has grown organically; worth a refactor pass independent of any pedagogy changes. Priya.
- **More human, plain-language AI coaching.** Push Coach mode toward chess.com-style approachable coaching language; let Pro mode lean more technical in contrast, widening the gap between the two rather than narrowing it. Overlaps directly with M4 (Renee → Priya) — fold in there rather than treating as separate work.
- **Declutter the top bar's game-mode controls.** Remove Human vs Human / Human vs AI / AI vs AI as top-bar options; make New Game the only entry point for selecting a mode. Dara (layout) → Priya (implementation).
- **Engine Lab is unclear.** Kris flagged not understanding what this feature is or does — needs a UX/naming/discoverability pass, or a plain explanation surfaced in-app. Dara → Renee (is it even something an adult improver needs?).
- **Reviewed game history.** No way currently to recall a previously reviewed game — add persistence/list view so past reviews can be reopened, not just the in-progress one. Complements M8's local-storage approach; Priya.

---

_Next: circulate to Priya, Dara, and Renee for domain-specific pushback before treating milestones as committed._
