import { useEffect, useState } from 'react'
import { isPlanComplete, isRatingCheckpointWeek, isSocialCheckinWeek, weekNumberForDate, weeklyFocusForWeek } from '../engine/trainingPlan'
import { useTrainingPlanDb } from '../hooks/useTrainingPlanDb'
import { IconBarChart, IconKing } from './icons'

type PlanState = {
    weekNumber: number
    currentStreak: number
    longestStreak: number
}

// The two small Training-tab summary cards: this week's focus and the
// streak. The day-by-day checklist itself lives in ChecklistPanel -- it
// needs far more room than a card in this grid can offer. Rating trend and
// badges stay "Coming soon" in TrainingView until their own data sources exist.
export function TrainingPlanSummary() {
    const db = useTrainingPlanDb()
    const [state, setState] = useState<PlanState | null>(null)

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const startedAt = await db.getOrStartPlan()
            const streak = await db.getStreakState()
            if (cancelled) return
            setState({
                weekNumber: weekNumberForDate(startedAt),
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
    const ratingCheckpoint = !complete && isRatingCheckpointWeek(state.weekNumber)
    const socialCheckin = !complete && isSocialCheckinWeek(state.weekNumber)

    return (
        <>
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
                {ratingCheckpoint && <span className="training-card-badge">Rating checkpoint</span>}
                {socialCheckin && <span className="training-card-badge">Check-in week</span>}
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
