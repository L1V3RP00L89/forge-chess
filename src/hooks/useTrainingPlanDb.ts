import { useCallback } from 'react'
import { query } from '../db/sqliteClient'
import { computeStreakUpdate, type StreakState } from '../engine/trainingPlan'

function todayDateOnly(): string {
    return new Date().toISOString().slice(0, 10)
}

export function useTrainingPlanDb() {
    // null means the user hasn't started the 12-week clock yet -- the
    // Training tab shows a "Start plan" button in that case rather than
    // silently starting it on first visit.
    const getPlanStartedAt = useCallback(async (): Promise<string | null> => {
        try {
            const rows = await query('SELECT started_at FROM training_plan WHERE id = 1')
            return rows[0] ? String(rows[0].started_at) : null
        } catch (error) {
            console.warn('Failed to load training plan start date', error)
            return null
        }
    }, [])

    // Explicit user action (the "Start plan" button) -- INSERT OR IGNORE so a
    // stray double-click can't push the clock forward and lose progress.
    const startPlan = useCallback(async (): Promise<string> => {
        const now = new Date().toISOString()
        try {
            await query('INSERT OR IGNORE INTO training_plan (id, started_at) VALUES (1, ?)', [now])
            const rows = await query('SELECT started_at FROM training_plan WHERE id = 1')
            return String(rows[0]?.started_at ?? now)
        } catch (error) {
            console.warn('Failed to start training plan', error)
            return now
        }
    }, [])

    const getStreakState = useCallback(async (): Promise<StreakState> => {
        try {
            const rows = await query('SELECT current_streak, longest_streak, last_active_date FROM streak_state WHERE id = 1')
            const row = rows[0]
            if (!row) return { currentStreak: 0, longestStreak: 0, lastActiveDate: null }
            return {
                currentStreak: Number(row.current_streak),
                longestStreak: Number(row.longest_streak),
                lastActiveDate: row.last_active_date == null ? null : String(row.last_active_date),
            }
        } catch (error) {
            console.warn('Failed to load streak state', error)
            return { currentStreak: 0, longestStreak: 0, lastActiveDate: null }
        }
    }, [])

    // Call once per Base Work completion (today: finishing a played game).
    // A same-day repeat is a no-op in computeStreakUpdate, so this is safe
    // to call on every game without double-counting the day.
    const recordBaseWorkDone = useCallback(async (): Promise<StreakState> => {
        const current = await getStreakState()
        const next = computeStreakUpdate(current, todayDateOnly())
        if (next === current) return current
        try {
            await query(
                'UPDATE streak_state SET current_streak = ?, longest_streak = ?, last_active_date = ? WHERE id = 1',
                [next.currentStreak, next.longestStreak, next.lastActiveDate],
            )
        } catch (error) {
            console.warn('Failed to record Base Work streak update', error)
        }
        return next
    }, [getStreakState])

    const hasPlayedToday = useCallback(async (): Promise<boolean> => {
        try {
            const rows = await query(
                "SELECT COUNT(*) AS n FROM games WHERE date(played_at) = date(?)",
                [new Date().toISOString()],
            )
            return Number(rows[0]?.n ?? 0) > 0
        } catch (error) {
            console.warn('Failed to check today\'s games', error)
            return false
        }
    }, [])

    return { getPlanStartedAt, startPlan, getStreakState, recordBaseWorkDone, hasPlayedToday }
}
