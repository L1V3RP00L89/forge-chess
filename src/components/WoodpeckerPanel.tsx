import { useCallback, useEffect, useState } from 'react'
import { useMissedTacticsDb, type StoredMissedTactic } from '../hooks/useMissedTacticsDb'
import { WoodpeckerDrillView } from './WoodpeckerDrillView'
import { IconPlay, IconZap } from './icons'
import './WoodpeckerPanel.css'

const DRILL_BATCH_SIZE = 15

export function WoodpeckerPanel() {
    const db = useMissedTacticsDb()
    const [dueCount, setDueCount] = useState(0)
    const [loading, setLoading] = useState(true)
    const [drilling, setDrilling] = useState<StoredMissedTactic[] | null>(null)

    const refresh = useCallback(async () => {
        setLoading(true)
        setDueCount(await db.countDue())
        setLoading(false)
    }, [db])

    useEffect(() => {
        void refresh()
        // Only on mount -- refresh is stable (useCallback).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleStartDrill = useCallback(async () => {
        const tactics = await db.listDue(DRILL_BATCH_SIZE)
        if (tactics.length === 0) return
        setDrilling(tactics)
    }, [db])

    const handleResult = useCallback((id: number, correct: boolean) => {
        void db.recordDrillResult(id, correct)
    }, [db])

    const handleExit = useCallback(() => {
        setDrilling(null)
        void refresh()
    }, [refresh])

    if (drilling) {
        return <WoodpeckerDrillView tactics={drilling} onRecordResult={handleResult} onExit={handleExit} />
    }

    return (
        <div className="woodpecker-panel">
            <h2><IconZap /> Woodpecker Queue</h2>
            {loading ? (
                <p className="woodpecker-panel-status">Loading…</p>
            ) : dueCount === 0 ? (
                <p className="woodpecker-panel-status">
                    Nothing queued yet — moves you say "I didn't have it" to in Coach mode's reveal show up here to redrill.
                </p>
            ) : (
                <>
                    <p className="woodpecker-panel-status">{dueCount} due now</p>
                    <button type="button" className="woodpecker-panel-start" onClick={() => void handleStartDrill()}>
                        <IconPlay /> Start drill
                    </button>
                </>
            )}
        </div>
    )
}
