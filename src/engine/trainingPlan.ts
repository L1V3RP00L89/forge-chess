// M8 Training tab: the 12-week structure sourced from ChessGoals' "Intermediate
// Adult Improver Plan" (see docs/PROJECT_BRIEF.md M8 Detail). Deliberately a
// fixed template, not a configurable planner -- mirrors the source plan
// exactly rather than inventing a generic scheduling system nobody asked for.

export const PLAN_LENGTH_WEEKS = 12

// Verified against the source PDF (Team Inbox/Intermediate Adult Improver
// 2021.pdf) directly, not just the brief's prose summary of it -- weeks 5
// and 12 are the only ones that actually ask for a rating comparison ("now
// would be a good time to compare your ratings", and the closing page's
// "revisit your ratings from the start"). Week 7 is a social check-in
// ("go check in on the ChessGoals Club... enjoying the Discord community"),
// not a rating checkpoint -- an earlier pass had wrongly folded it in.
export const RATING_CHECKPOINT_WEEKS = [5, 12] as const
export const SOCIAL_CHECKIN_WEEK = 7

export const WEEKLY_FOCI = ['Woodpecker', 'Opening Review', 'Strategy Review', 'Endgame Review'] as const
export type WeeklyFocus = (typeof WEEKLY_FOCI)[number]

const DAY_MS = 24 * 60 * 60_000
const WEEK_MS = 7 * DAY_MS

/** 1-indexed week number, clamped to the plan's 12 weeks (week 13+ reads as "plan complete"). */
export function weekNumberForDate(startedAt: string, now: Date = new Date()): number {
    const elapsedMs = Math.max(0, now.getTime() - new Date(startedAt).getTime())
    const week = Math.floor(elapsedMs / WEEK_MS) + 1
    return Math.min(week, PLAN_LENGTH_WEEKS + 1)
}

/** 1-indexed day within the current week (1-7), independent of week number. */
export function dayInWeekForDate(startedAt: string, now: Date = new Date()): number {
    const elapsedMs = Math.max(0, now.getTime() - new Date(startedAt).getTime())
    return Math.floor(elapsedMs / DAY_MS) % 7 + 1
}

export function isPlanComplete(weekNumber: number): boolean {
    return weekNumber > PLAN_LENGTH_WEEKS
}

/** Woodpecker -> Opening -> Strategy -> Endgame, repeating every 4 weeks. */
export function weeklyFocusForWeek(weekNumber: number): WeeklyFocus {
    const index = (weekNumber - 1) % WEEKLY_FOCI.length
    return WEEKLY_FOCI[index]!
}

export function isRatingCheckpointWeek(weekNumber: number): boolean {
    return (RATING_CHECKPOINT_WEEKS as readonly number[]).includes(weekNumber)
}

export function isSocialCheckinWeek(weekNumber: number): boolean {
    return weekNumber === SOCIAL_CHECKIN_WEEK
}

export type ChecklistItem = {
    key: string
    label: string
}

// Every week's Day 1/3/5 is one 15+10-or-slower game + analysis; Day 2/4/6
// is four 5+5 games + analysis; Day 7 has no game at all, just that week's
// rotating review focus, tracked for time. Matches the source PDF's
// per-week table exactly (the "Update study plan post" / Discord-forum
// items are a community-forum ritual with no in-app equivalent, so they're
// deliberately left out here).
export function baseWorkItemsForDay(dayInWeek: number, focus: WeeklyFocus): ChecklistItem[] {
    if (dayInWeek === 7) {
        return [{ key: 'review-day', label: `${focus} — track your time` }]
    }
    if (dayInWeek % 2 === 0) {
        return [
            { key: 'play-blitz', label: 'Play four 5+5 games' },
            { key: 'analyze-blitz', label: 'Analyze them — 2 things that went well, 2 to work on' },
        ]
    }
    return [
        { key: 'play-rapid', label: 'Play a 15+10 game (or slower)' },
        { key: 'analyze-rapid', label: 'Analyze it — 2 things that went well, 2 to work on' },
    ]
}

// Extra Credit is the same fixed list every week (not gated by that week's
// review focus -- all three review types are available every week; only
// which one gets Day 7's dedicated, time-tracked slot rotates). The first
// group is meant to be worked in order; the second is any order.
export const EXTRA_CREDIT_ORDERED: ChecklistItem[] = [
    { key: 'slow-1', label: 'Slow Game 1' },
    { key: 'slow-1-analyze', label: 'Analyze Slow Game 1' },
    { key: 'woodpecker', label: 'Woodpecker Method' },
    { key: 'slow-2', label: 'Slow Game 2' },
    { key: 'slow-2-analyze', label: 'Analyze Slow Game 2' },
]

export const EXTRA_CREDIT_ANY_ORDER: ChecklistItem[] = [
    { key: 'opening-review', label: 'Opening Review' },
    { key: 'endgame-review', label: 'Endgame Review' },
    { key: 'strategy-review', label: 'Strategy Review' },
    { key: 'chess-content', label: 'Chess Content' },
]

export type StreakState = {
    currentStreak: number
    longestStreak: number
    lastActiveDate: string | null
}

function toDateOnly(iso: string): string {
    return iso.slice(0, 10)
}

/**
 * Base Work completion advances the streak once per calendar day. Renee's
 * call: streak counts Base Work only (today = "played a game"), never app
 * opens or games played beyond the first -- see the Pitfalls section's
 * "gamification drifting into vanity metrics" guard.
 */
export function computeStreakUpdate(current: StreakState, today: string = toDateOnly(new Date().toISOString())): StreakState {
    if (current.lastActiveDate === today) return current

    const isConsecutiveDay = current.lastActiveDate != null
        && toDateOnly(new Date(new Date(current.lastActiveDate).getTime() + DAY_MS).toISOString()) === today

    const currentStreak = isConsecutiveDay ? current.currentStreak + 1 : 1
    return {
        currentStreak,
        longestStreak: Math.max(current.longestStreak, currentStreak),
        lastActiveDate: today,
    }
}
