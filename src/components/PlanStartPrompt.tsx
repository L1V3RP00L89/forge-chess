import { useCallback, useState } from 'react'
import { useTrainingPlanDb } from '../hooks/useTrainingPlanDb'
import { IconPlay } from './icons'
import './PlanStartPrompt.css'

type Props = {
    onStarted: (startedAt: string) => void
}

// Shown until the user explicitly kicks off the 12-week clock -- an earlier
// version auto-started it silently on first Training-tab visit, which meant
// nobody actually chose their day 1.
export function PlanStartPrompt({ onStarted }: Props) {
    const db = useTrainingPlanDb()
    const [starting, setStarting] = useState(false)

    const handleStart = useCallback(() => {
        setStarting(true)
        void db.startPlan().then(onStarted)
    }, [db, onStarted])

    return (
        <div className="plan-start-prompt">
            <h2>Start your 12-week plan</h2>
            <p>
                A structured week-by-week cycle (Woodpecker, Opening, Strategy, and Endgame review, rotating) with a daily
                checklist and a streak that tracks Base Work. Today becomes Day 1, Week 1 — the clock doesn't start until you do.
            </p>
            <button type="button" className="plan-start-btn" onClick={handleStart} disabled={starting}>
                <IconPlay /> {starting ? 'Starting…' : 'Start plan'}
            </button>
        </div>
    )
}
