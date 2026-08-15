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
2. **A user can review a game** and come away knowing *what to work on*, not just where their accuracy dropped. This is the outcome most at risk — see Pitfalls.
3. **A user can go from beginner to advanced** inside one tool: Coach mode hides complexity by default; Pro mode exposes MultiPV, WDL, cloud eval, and full UCI controls without the app becoming two products.
4. **The app stays free and installable** — PWA metadata, GitHub Pages hosting, no server costs, no paywall gating depth (the stated gap in chess.com's offering).
5. **The codebase stays shippable** — `npm audit`, lint, tests, and build all pass on every push (already enforced in CI); this outcome protects all the others.

## Milestones

Grounded in what's already shipped (565 commits, spanning 2026-01-29 to 2026-06-01) versus what the team's existing docs (`ANALYSIS_DESIGN.md`, `docs/analysis-tool-design.md`) still call out as open:

| # | Milestone | State | Owner |
|---|---|---|---|
| M1 | Core play/analysis/review loop (board, engine worker, PGN/FEN, opening explorer, tablebase, review pass) | **Shipped** — this is the bulk of the 565-commit history | Priya (maintain) |
| M2 | Mobile/responsive polish (touch targets, dialog layout, panel collapsing) | **Ongoing** — most recent commit stream before the gap was mobile-focused `fix:`/`style:` work | Dara → Priya |
| M3 | Re-baseline after the dormant period | **Not started** | Priya |
| M4 | Coach-mode pedagogy pass — audit plain-language guidance against what an adult improver actually needs (plans/patterns over raw eval) | **Not started** | Renee → Priya |
| M5 | Review/accuracy framing pass — reframe critical-moment surfacing around "worth an adult's limited study time" rather than raw centipawn loss | **Not started** | Renee → Priya |
| M6 | Opening explorer presentation — thin, memorable repertoire framing vs. theory-dump | **Not started** | Renee → Dara → Priya |
| M7 | Full-strength CDN engine profile completion (113MB builds, opt-in, LFS-aware deploy) | **Partially shipped** — commit history shows LFS/CDN work already done; confirm it's still functioning | Priya |
| M8 | Training feature — built-in habit-tracking/coaching plan (see below) | **Scoped, not started** | Renee → Dara → Priya |

**M3 is new and matters**: the repo's last commit is **2026-06-01**; today is **2026-08-15** — roughly 2.5 months with no activity. Before any new feature work, Priya should re-run the full quality gate locally (`npm audit`, `npm run lint`, `npm test -- --run`, `npm run build`) and confirm CI still passes, since dependency drift or upstream Stockfish/Lichess API changes could have broken something silently in that gap.

## M8 Detail — Training Feature

Sourced directly from a real coach-assigned program (ChessGoals' "Intermediate Adult Improver Plan," 12-week structure at 1100–1699 rating, 80/20 playing-to-studying split). Scoped in full through user + Renee + Dara collaboration:

**Structure — built-in template, not a generic configurable system:**
- 12-week cycle with a weekly rotating focus (Woodpecker → Opening Review → Strategy Review → Endgame Review, repeating), mirroring the source plan exactly.
- Each day splits into **Base Work** (daily games, one long game + analysis, alternating with short-game blocks) and **Extra Credit** (slow games, Woodpecker, opening/endgame/strategy review) — a ready-made must-do/bonus tier.
- Checkpoint milestones at week 5, week 7, and week 12, each tied to an actual rating comparison against the plan's start — skill-first, per Renee's mandate, not attendance-first.

**Three concrete sub-features:**
1. **Woodpecker blunder-drill queue** — pulls puzzles from the user's *own* missed tactics (not a generic set), resurfaced spaced-repetition style until solved reliably. This is the personalization layer that differentiates it from the source plan's generic puzzle sets.
2. **Post-game journal prompt** — after every review pass, a skippable modal asks for two things that went well and two to work on. Stored with the game record. This operationalizes the source plan's "2 positive / 2 constructive takeaways" ritual, which Renee flagged as the single most valuable habit in the source document.
3. **Training tab** — new top-level nav item, set as the **default landing view** (opens before the board) to reinforce the daily habit. Shows: today's checklist, current week's focus, a visible rating trend graph, a streak counter, and skill-earned badges (e.g. "5 forks spotted in a row," "3 endgames converted clean") with locked badges showing what's needed to unlock — explicitly *not* activity-farmed (no badges for games played or app opens, streak only counts Base Work completion).

**Storage:** local-only (localStorage/IndexedDB), consistent with the rest of the app's no-backend approach.

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

---

*Next: circulate to Priya, Dara, and Renee for domain-specific pushback before treating milestones as committed.*
