// M8 Training tab: the 12-week structure sourced from ChessGoals' "Intermediate
// Adult Improver Plan" (see docs/PROJECT_BRIEF.md M8 Detail). Deliberately a
// fixed template, not a configurable planner -- mirrors the source plan
// exactly rather than inventing a generic scheduling system nobody asked for.

export const PLAN_LENGTH_WEEKS = 12
export const CHECKPOINT_WEEKS = [5, 7, 12] as const

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

export function isPlanComplete(weekNumber: number): boolean {
    return weekNumber > PLAN_LENGTH_WEEKS
}

/** Woodpecker -> Opening -> Strategy -> Endgame, repeating every 4 weeks. */
export function weeklyFocusForWeek(weekNumber: number): WeeklyFocus {
    const index = (weekNumber - 1) % WEEKLY_FOCI.length
    return WEEKLY_FOCI[index]!
}

export function isCheckpointWeek(weekNumber: number): boolean {
    return (CHECKPOINT_WEEKS as readonly number[]).includes(weekNumber)
}

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
