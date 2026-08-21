import { useCallback, useEffect, useState } from 'react'
import {
    EXTRA_CREDIT_ANY_ORDER,
    EXTRA_CREDIT_ORDERED,
    baseWorkItemsForDay,
    dayInWeekForDate,
    isPlanComplete,
    weekNumberForDate,
    weeklyFocusForWeek,
    type ChecklistItem,
} from '../engine/trainingPlan'
import { useChecklistDb } from '../hooks/useChecklistDb'
import { useTrainingPlanDb } from '../hooks/useTrainingPlanDb'
import './ChecklistPanel.css'

function todayDateOnly(): string {
    return new Date().toISOString().slice(0, 10)
}

type Loaded = {
    dateKey: string
    weekKey: string
    dayInWeek: number
    baseItems: ChecklistItem[]
    baseChecked: Set<string>
    extraChecked: Set<string>
}

function ChecklistGroup({
    title,
    items,
    checked,
    onToggle,
}: {
    title: string
    items: ChecklistItem[]
    checked: Set<string>
    onToggle: (key: string, next: boolean) => void
}) {
    return (
        <div className="checklist-group">
            <h3>{title}</h3>
            <ul className="checklist-items">
                {items.map(item => {
                    const isChecked = checked.has(item.key)
                    return (
                        <li key={item.key} className={isChecked ? 'checklist-item done' : 'checklist-item'}>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={event => onToggle(item.key, event.target.checked)}
                                />
                                {item.label}
                            </label>
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

// Real per-day Base Work (15+10 on odd days, four 5+5 on even days, that
// week's review focus on day 7 -- see trainingPlan.ts) plus the fixed
// weekly Extra Credit list. Most items happen outside this app (Woodpecker
// book, lichess/chess.com analysis, opening review) so they're
// self-reported checkboxes, not auto-graded -- only the day's game item is
// auto-ticked from real data (a game recorded today), and even that stays
// user-toggleable afterward.
export function ChecklistPanel() {
    const planDb = useTrainingPlanDb()
    const checklistDb = useChecklistDb()
    const [state, setState] = useState<Loaded | null>(null)
    const [complete, setComplete] = useState(false)

    useEffect(() => {
        let cancelled = false
        void (async () => {
            const startedAt = await planDb.getOrStartPlan()
            const weekNumber = weekNumberForDate(startedAt)
            if (isPlanComplete(weekNumber)) {
                if (!cancelled) setComplete(true)
                return
            }
            const dayInWeek = dayInWeekForDate(startedAt)
            const focus = weeklyFocusForWeek(weekNumber)
            const baseItems = baseWorkItemsForDay(dayInWeek, focus)
            const dateKey = todayDateOnly()
            const weekKey = `week-${weekNumber}`

            const playItem = baseItems.find(item => item.key.startsWith('play-'))
            if (playItem && await planDb.hasPlayedToday()) {
                await checklistDb.setChecked(dateKey, playItem.key, true)
            }

            const [baseChecked, extraChecked] = await Promise.all([
                checklistDb.getChecked(dateKey),
                checklistDb.getChecked(weekKey),
            ])
            if (cancelled) return
            setState({ dateKey, weekKey, dayInWeek, baseItems, baseChecked, extraChecked })
        })()
        return () => { cancelled = true }
        // Only on mount -- planDb/checklistDb's functions are stable (useCallback).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const toggleBase = useCallback((key: string, next: boolean) => {
        setState(current => {
            if (!current) return current
            const baseChecked = new Set(current.baseChecked)
            if (next) baseChecked.add(key)
            else baseChecked.delete(key)
            void checklistDb.setChecked(current.dateKey, key, next)
            return { ...current, baseChecked }
        })
    }, [checklistDb])

    const toggleExtra = useCallback((key: string, next: boolean) => {
        setState(current => {
            if (!current) return current
            const extraChecked = new Set(current.extraChecked)
            if (next) extraChecked.add(key)
            else extraChecked.delete(key)
            void checklistDb.setChecked(current.weekKey, key, next)
            return { ...current, extraChecked }
        })
    }, [checklistDb])

    if (complete) {
        return (
            <div className="checklist-panel">
                <p className="checklist-complete">12-week plan complete — see the closing checkpoint on the Streak card above.</p>
            </div>
        )
    }

    if (!state) return null

    return (
        <div className="checklist-panel">
            <h2>Day {state.dayInWeek} of this week</h2>
            <ChecklistGroup title="Base Work" items={state.baseItems} checked={state.baseChecked} onToggle={toggleBase} />
            <ChecklistGroup title="Extra Credit — complete in order" items={EXTRA_CREDIT_ORDERED} checked={state.extraChecked} onToggle={toggleExtra} />
            <ChecklistGroup title="Extra Credit — any order" items={EXTRA_CREDIT_ANY_ORDER} checked={state.extraChecked} onToggle={toggleExtra} />
        </div>
    )
}
