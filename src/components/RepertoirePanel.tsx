import { useCallback, useEffect, useRef, useState } from 'react'
import { parseRepertoirePgn } from '../engine/repertoire'
import type { RepertoireSide } from '../engine/repertoire'
import { useRepertoireDb, type RepertoireSummary, type StoredDrillUnit } from '../hooks/useRepertoireDb'
import { RepertoireDrillView } from './RepertoireDrillView'
import { IconPlay, IconTrash, IconUpload } from './icons'
import './RepertoirePanel.css'

const SIDES: Array<{ side: RepertoireSide; label: string }> = [
    { side: 'w', label: 'White' },
    { side: 'b', label: 'Black' },
]

type SlotState = {
    summary: RepertoireSummary | null
    dueCount: number
    loading: boolean
    error: string | null
}

const EMPTY_SLOT: SlotState = { summary: null, dueCount: 0, loading: true, error: null }

export function RepertoirePanel() {
    const db = useRepertoireDb()
    const [slots, setSlots] = useState<Record<RepertoireSide, SlotState>>({ w: EMPTY_SLOT, b: EMPTY_SLOT })
    const [drilling, setDrilling] = useState<{ side: RepertoireSide; rootFen: string; units: StoredDrillUnit[] } | null>(null)
    const fileInputRefs = useRef<Record<RepertoireSide, HTMLInputElement | null>>({ w: null, b: null })

    const refreshSlot = useCallback(async (side: RepertoireSide) => {
        const summary = await db.getRepertoireSummary(side)
        const dueCount = summary ? await db.countDueUnits(side) : 0
        setSlots(prev => ({ ...prev, [side]: { summary, dueCount, loading: false, error: null } }))
    }, [db])

    useEffect(() => {
        void refreshSlot('w')
        void refreshSlot('b')
        // Only on mount — refreshSlot is stable (useCallback) and re-running this
        // per render would refetch on every keystroke elsewhere in the app.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleFileChosen = useCallback(async (side: RepertoireSide, file: File) => {
        setSlots(prev => ({ ...prev, [side]: { ...prev[side], loading: true, error: null } }))
        try {
            const text = await file.text()
            const parseResult = parseRepertoirePgn(text)
            if (parseResult.mergedGameCount === 0) {
                setSlots(prev => ({
                    ...prev,
                    [side]: { summary: null, dueCount: 0, loading: false, error: 'No usable games found in that file.' },
                }))
                return
            }
            const summary = await db.importRepertoire(side, file.name, parseResult)
            if (!summary) {
                setSlots(prev => ({
                    ...prev,
                    [side]: { summary: null, dueCount: 0, loading: false, error: 'Import failed — see console for details.' },
                }))
                return
            }
            await refreshSlot(side)
        } catch (error) {
            setSlots(prev => ({
                ...prev,
                [side]: {
                    summary: null,
                    dueCount: 0,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Import failed.',
                },
            }))
        }
    }, [db, refreshSlot])

    const handleRemove = useCallback(async (side: RepertoireSide) => {
        setSlots(prev => ({ ...prev, [side]: { ...prev[side], loading: true } }))
        await db.removeRepertoire(side)
        await refreshSlot(side)
    }, [db, refreshSlot])

    const handleStartDrill = useCallback(async (side: RepertoireSide) => {
        const slot = slots[side]
        if (!slot.summary) return
        const units = await db.listDueUnits(side, 20)
        if (units.length === 0) return
        setDrilling({ side, rootFen: slot.summary.rootFen, units })
    }, [db, slots])

    const handleDrillResult = useCallback((unitId: number, correct: boolean) => {
        void db.recordDrillResult(unitId, correct)
    }, [db])

    const handleExitDrill = useCallback(() => {
        const side = drilling?.side
        setDrilling(null)
        if (side) void refreshSlot(side)
    }, [drilling, refreshSlot])

    if (drilling) {
        return (
            <RepertoireDrillView
                ownerColor={drilling.side}
                rootFen={drilling.rootFen}
                units={drilling.units}
                onRecordResult={handleDrillResult}
                onExit={handleExitDrill}
            />
        )
    }

    return (
        <div className="repertoire-panel">
            <h2>My Repertoires</h2>
            <div className="repertoire-slots">
                {SIDES.map(({ side, label }) => {
                    const slot = slots[side]
                    return (
                        <div className="repertoire-slot" key={side}>
                            <div className="repertoire-slot-head">
                                <span className={`repertoire-slot-swatch ${side === 'w' ? 'white' : 'black'}`} aria-hidden="true" />
                                <span className="repertoire-slot-label">{label}</span>
                            </div>
                            {slot.loading ? (
                                <p className="repertoire-slot-status">Loading…</p>
                            ) : slot.summary ? (
                                <>
                                    <p className="repertoire-slot-status">
                                        {slot.summary.sourceFilename ?? 'Imported repertoire'} · {slot.summary.drillUnitCount} decision points
                                    </p>
                                    <p className="repertoire-slot-status">
                                        {slot.dueCount > 0 ? `${slot.dueCount} due now` : 'Nothing due right now'}
                                    </p>
                                    <div className="repertoire-slot-actions">
                                        <button
                                            type="button"
                                            className="repertoire-slot-primary"
                                            disabled={slot.dueCount === 0}
                                            onClick={() => void handleStartDrill(side)}
                                        >
                                            <IconPlay /> Start drill
                                        </button>
                                        <button
                                            type="button"
                                            className="repertoire-slot-secondary"
                                            onClick={() => void handleRemove(side)}
                                            aria-label={`Remove ${label} repertoire`}
                                        >
                                            <IconTrash />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="repertoire-slot-status">Not imported</p>
                                    {slot.error && <p className="repertoire-slot-error">{slot.error}</p>}
                                    <button
                                        type="button"
                                        className="repertoire-slot-primary"
                                        onClick={() => fileInputRefs.current[side]?.click()}
                                    >
                                        <IconUpload /> Import PGN
                                    </button>
                                    <input
                                        ref={el => { fileInputRefs.current[side] = el }}
                                        type="file"
                                        accept=".pgn,text/plain"
                                        className="repertoire-slot-file-input"
                                        onChange={event => {
                                            const file = event.target.files?.[0]
                                            event.target.value = ''
                                            if (file) void handleFileChosen(side, file)
                                        }}
                                    />
                                </>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
