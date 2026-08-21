import { useEffect, useState } from 'react'
import { isPlanComplete, isRatingCheckpointWeek, isSocialCheckinWeek, weekNumberForDate, weeklyFocusForWeek } from '../engine/trainingPlan'
import { useTrainingPlanDb } from '../hooks/useTrainingPlanDb'
import { IconBarChart, IconKing } from './icons'

type Props = {
    startedAt: string
}

type StreakInfo = {
    currentStreak: number
    longestStreak: number
}

// The two small Training-tab summary cards: this week's focus and the
// streak. The day-by-day checklist itself lives in ChecklistPanel -- it
// needs far more room than a card in this grid can offer. Rating trend and
// badges stay "Coming soon" in TrainingView until their own data sources exist.
export function TrainingPlanSummary({ startedAt }: Props) {
    const db = useTrainingPlanDb()
    const [streak, setStreak] = useState<StreakInfo | null>(null)

    useEffect(() => {
        let cancelled = false
        void db.getStreakState().then(state => {
            if (!cancelled) setStreak({ currentStreak: state.currentStreak, longestStreak: state.longestStreak })
        })
        return () => { cancelled = true }
        // Only on mount -- db's functions are stable (useCallback).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    if (!streak) return null

    const weekNumber = weekNumberForDate(startedAt)
    const complete = isPlanComplete(weekNumber)
    const focus = complete ? null : weeklyFocusForWeek(weekNumber)
    const ratingCheckpoint = !complete && isRatingCheckpointWeek(weekNumber)
    const socialCheckin = !complete && isSocialCheckinWeek(weekNumber)

    return (
        <>
            <div className="training-card">
                <span className="training-card-icon"><IconKing /></span>
                <div>
                    <h2>This week's focus</h2>
                    <p>
                        {complete
                            ? `Week ${weekNumber - 1} of 12 complete — plan finished`
                            : `Week ${weekNumber} of 12 · ${focus}`}
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
                        {streak.currentStreak > 0
                            ? `${streak.currentStreak}-day streak (longest: ${streak.longestStreak})`
                            : 'No active streak yet — Base Work today starts one'}
                    </p>
                </div>
            </div>
        </>
    )
}
