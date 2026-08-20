import { IconBarChart, IconCrown, IconHistory, IconKing, IconPlay, IconTrendingUp } from './icons'
import { RepertoirePanel } from './RepertoirePanel'
import './TrainingView.css'

type Props = {
    onOpenApp: () => void
}

const COMING_SOON_CARDS = [
    {
        icon: <IconHistory />,
        title: "Today's checklist",
        description: 'Base Work and Extra Credit for today, pulled from your 12-week plan.',
    },
    {
        icon: <IconKing />,
        title: "This week's focus",
        description: 'Woodpecker, Opening Review, Strategy Review, or Endgame Review — rotating weekly.',
    },
    {
        icon: <IconTrendingUp />,
        title: 'Rating trend',
        description: 'Your rating over the course of the plan, checkpointed at weeks 5, 7, and 12.',
    },
    {
        icon: <IconBarChart />,
        title: 'Streak & badges',
        description: 'A streak counter for completed Base Work, plus badges earned from real skill milestones.',
    },
]

export function TrainingView({ onOpenApp }: Props) {
    return (
        <main className="training-view">
            <header className="training-header">
                <span className="training-brand-icon"><IconCrown /></span>
                <h1>Training</h1>
                <p className="training-subhead">Your 12-week adult-improver plan lives here.</p>
            </header>

            <div className="training-cards">
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

            <RepertoirePanel />

            <button type="button" className="training-enter-app-btn" onClick={onOpenApp}>
                <IconPlay /> Go to board
            </button>
        </main>
    )
}
