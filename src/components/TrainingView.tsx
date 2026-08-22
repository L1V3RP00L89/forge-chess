import { useCallback, useEffect, useState } from 'react'
import { useTrainingPlanDb } from '../hooks/useTrainingPlanDb'
import { ChecklistPanel } from './ChecklistPanel'
import { IconBarChart, IconCrown, IconPlay, IconRefresh, IconTrendingUp } from './icons'
import { PlanStartPrompt } from './PlanStartPrompt'
import { RepertoirePanel } from './RepertoirePanel'
import { TrainingPlanSummary } from './TrainingPlanSummary'
import { WoodpeckerPanel } from './WoodpeckerPanel'
import './TrainingView.css'

type Props = {
    onOpenApp: () => void
}

// Still unbuilt: rating trend needs a rating data source that doesn't exist
// yet (deferred pending a chess.com/manual-entry decision), and badges need
// Renee's skill-meaningful criteria defined before they're worth building.
const COMING_SOON_CARDS = [
    {
        icon: <IconTrendingUp />,
        title: 'Rating trend',
        description: 'Your rating over the course of the plan, checkpointed at weeks 5 and 12.',
    },
    {
        icon: <IconBarChart />,
        title: 'Badges',
        description: 'Skill-earned milestones (e.g. "5 forks spotted in a row") — never for games played or app opens.',
    },
]

export function TrainingView({ onOpenApp }: Props) {
    const planDb = useTrainingPlanDb()
    // undefined = still loading, null = not started yet, string = started_at
    const [startedAt, setStartedAt] = useState<string | null | undefined>(undefined)

    useEffect(() => {
        let cancelled = false
        void planDb.getPlanStartedAt().then(value => {
            if (!cancelled) setStartedAt(value)
        })
        return () => { cancelled = true }
        // Only on mount -- planDb's functions are stable (useCallback).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleRestart = useCallback(() => {
        if (!window.confirm('Restart the 12-week plan? This resets the clock to Day 1, Week 1, and clears your checklist progress. Your streak is unaffected.')) {
            return
        }
        void planDb.restartPlan().then(setStartedAt)
    }, [planDb])

    return (
        <main className="training-view">
            <header className="training-header">
                <span className="training-brand-icon"><IconCrown /></span>
                <h1>Training</h1>
                <p className="training-subhead">Your 12-week adult-improver plan lives here.</p>
            </header>

            {startedAt === undefined ? null : startedAt === null ? (
                <PlanStartPrompt onStarted={setStartedAt} />
            ) : (
                <>
                    <div className="training-cards">
                        <TrainingPlanSummary startedAt={startedAt} />
                        {COMING_SOON_CARDS.map(card => (
                            <div className="training-card" key={card.title}>
                                <span className="training-card-icon">{card.icon}</span>
                                <div>
                                    <h2>{card.title}</h2>
                                    <p>{card.description}</p>
                                </div>
                                <span className="training-card-badge">Coming soon</span>
                            </div>
                        ))}
                    </div>

                    <ChecklistPanel startedAt={startedAt} />

                    <button type="button" className="training-restart-btn" onClick={handleRestart}>
                        <IconRefresh /> Restart plan
                    </button>
                </>
            )}

            <WoodpeckerPanel />

            <RepertoirePanel />

            <button type="button" className="training-enter-app-btn" onClick={onOpenApp}>
                <IconPlay /> Go to board
            </button>
        </main>
    )
}
