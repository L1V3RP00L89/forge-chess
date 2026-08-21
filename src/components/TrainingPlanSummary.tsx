import { useEffect, useState } from 'react'
import { isCheckpointWeek, isPlanComplete, weekNumberForDate, weeklyFocusForWeek } from '../engine/trainingPlan'
import { useTrainingPlanDb } from '../hooks/useTrainingPlanDb'
import { IconBarChart, IconHistory, IconKing } from './icons'

type PlanState = {
    weekNumber: number
    hasPlayedToday: boolean
    currentStreak: number
    longestStreak: number
}

// Renders the three Training-tab cards backed by real plan/streak data (the
// checklist, this week's focus, and the streak) -- rating trend and badges
// stay "Coming soon" in TrainingView until their own data sources exist.
export function TrainingPlanSummary() {
    const db = useTrainingPlanDb()
    const [state, setState] = useState<PlanState | null>(null)

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const startedAt = await db.getOrStartPlan()
            const [streak, played] = await Promise.all([db.getStreakState(), db.hasPlayedToday()])
            if (cancelled) return
            setState({
                weekNumber: weekNumberForDate(startedAt),
                hasPlayedToday: played,
                currentStreak: streak.currentStreak,
                longestStreak: streak.longestStreak,
            })
        })()
        return () => { cancelled = true }
        // Only on mount -- db's functions are stable (useCallback).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!state) return null

    const complete = isPlanComplete(state.weekNumber)
    const focus = complete ? null : weeklyFocusForWeek(state.weekNumber)
    const checkpoint = !complete && isCheckpointWeek(state.weekNumber)

    return (
        <>
            <div className="training-card">
                <span className="training-card-icon"><IconHistory /></span>
                <div>
                    <h2>Today's checklist</h2>
                    <p className={state.hasPlayedToday ? 'training-checklist-done' : undefined}>
                        {state.hasPlayedToday ? '✓ Base Work — play a game (done)' : 'Base Work — play a game'}
                    </p>
                </div>
            </div>

            <div className="training-card">
                <span className="training-card-icon"><IconKing /></span>
                <div>
                    <h2>This week's focus</h2>
                    <p>
                        {complete
                            ? `Week ${state.weekNumber - 1} of 12 complete — plan finished`
                            : `Week ${state.weekNumber} of 12 · ${focus}`}
                    </p>
                </div>
                {checkpoint && <span className="training-card-badge">Checkpoint</span>}
            </div>

            <div className="training-card">
                <span className="training-card-icon"><IconBarChart /></span>
                <div>
                    <h2>Streak</h2>
                    <p>
                        {state.currentStreak > 0
                            ? `${state.currentStreak}-day streak (longest: ${state.longestStreak})`
                            : 'No active streak yet — Base Work today starts one'}
                    </p>
                </div>
            </div>
        </>
    )
}
