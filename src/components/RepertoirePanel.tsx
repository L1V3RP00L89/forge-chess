import { useCallback, useEffect, useRef, useState } from 'react'
import { parseRepertoirePgn } from '../engine/repertoire'
import type { RepertoireSide } from '../engine/repertoire'
import { useRepertoireDb, type GradeDistribution, type RepertoireSummary, type StoredDrillUnit } from '../hooks/useRepertoireDb'
import { RepertoireDrillView } from './RepertoireDrillView'
import { IconEye, IconPlay, IconTrash, IconUpload } from './icons'
import './RepertoirePanel.css'

const SIDES: Array<{ side: RepertoireSide; label: string }> = [
    { side: 'w', label: 'White' },
    { side: 'b', label: 'Black' },
]

const EMPTY_GRADES: GradeDistribution = { new: 0, f: 0, e: 0, d: 0, c: 0, b: 0, a: 0 }

const GRADE_BARS: Array<{ key: keyof GradeDistribution; label: string; className: string }> = [
    { key: 'new', label: 'New', className: 'new' },
    { key: 'f', label: 'F', className: 'f' },
    { key: 'e', label: 'E', className: 'e' },
    { key: 'd', label: 'D', className: 'd' },
    { key: 'c', label: 'C', className: 'c' },
    { key: 'b', label: 'B', className: 'b' },
    { key: 'a', label: 'A', className: 'a' },
]

function GradeBar({ grades }: { grades: GradeDistribution }) {
    const max = Math.max(1, ...GRADE_BARS.map(({ key }) => grades[key]))
    return (
        <div className="repertoire-grade-bar" aria-label="Progress by mastery grade">
            {GRADE_BARS.map(({ key, label, className }) => {
                const count = grades[key]
                const heightPct = count === 0 ? 4 : Math.max(8, Math.round((count / max) * 100))
                return (
                    <div className="repertoire-grade-col" key={key}>
                        {count > 0 && <span className="repertoire-grade-count">{count}</span>}
                        <div
                            className={`repertoire-grade-fill ${className}`}
                            style={{ height: `${heightPct}%` }}
                        />
                        <span className="repertoire-grade-label">{label}</span>
                    </div>
                )
            })}
        </div>
    )
}

type SlotState = {
    summary: RepertoireSummary | null
    dueCount: number
    grades: GradeDistribution
    loading: boolean
    error: string | null
}

const EMPTY_SLOT: SlotState = { summary: null, dueCount: 0, grades: EMPTY_GRADES, loading: true, error: null }

export function RepertoirePanel() {
    const db = useRepertoireDb()
    const [slots, setSlots] = useState<Record<RepertoireSide, SlotState>>({ w: EMPTY_SLOT, b: EMPTY_SLOT })
    const [drilling, setDrilling] = useState<{ side: RepertoireSide; mode: 'view' | 'study'; rootFen: string; units: StoredDrillUnit[] } | null>(null)
    const fileInputRefs = useRef<Record<RepertoireSide, HTMLInputElement | null>>({ w: null, b: null })

    const refreshSlot = useCallback(async (side: RepertoireSide) => {
        const summary = await db.getRepertoireSummary(side)
        const dueCount = summary ? await db.countDueUnits(side) : 0
        const grades = summary ? await db.getGradeDistribution(side) : EMPTY_GRADES
        setSlots(prev => ({ ...prev, [side]: { summary, dueCount, grades, loading: false, error: null } }))
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
                    [side]: { summary: null, dueCount: 0, grades: EMPTY_GRADES, loading: false, error: 'No usable games found in that file.' },
                }))
                return
            }
            const summary = await db.importRepertoire(side, file.name, parseResult)
            if (!summary) {
                setSlots(prev => ({
                    ...prev,
                    [side]: { summary: null, dueCount: 0, grades: EMPTY_GRADES, loading: false, error: 'Import failed — see console for details.' },
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
                    grades: EMPTY_GRADES,
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
        setDrilling({ side, mode: 'study', rootFen: slot.summary.rootFen, units })
    }, [db, slots])

    // View Line is a passive read-through of the whole repertoire -- not
    // gated on anything being due, since it never touches SRS scheduling.
    const handleViewLine = useCallback(async (side: RepertoireSide) => {
        const slot = slots[side]
        if (!slot.summary) return
        const units = await db.listAllUnits(side)
        if (units.length === 0) return
        setDrilling({ side, mode: 'view', rootFen: slot.summary.rootFen, units })
    }, [db, slots])

    const handleDrillResult = useCallback((unitId: number, correct: boolean) => {
        void db.recordDrillResult(unitId, correct)
    }, [db])

    const handleIntroduced = useCallback((unitId: number) => {
        void db.markIntroduced(unitId)
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
                mode={drilling.mode}
                rootFen={drilling.rootFen}
                units={drilling.units}
                onRecordResult={handleDrillResult}
                onIntroduced={handleIntroduced}
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
                                    <GradeBar grades={slot.grades} />
                                    <div className="repertoire-slot-actions">
                                        <button
                                            type="button"
                                            className="repertoire-slot-primary"
                                            disabled={slot.dueCount === 0}
                                            onClick={() => void handleStartDrill(side)}
                                        >
                                            <IconPlay /> Study line
                                        </button>
                                        <button
                                            type="button"
                                            className="repertoire-slot-secondary"
                                            onClick={() => void handleViewLine(side)}
                                        >
                                            <IconEye /> View line
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
                                        accept=".pgn,.txt,text/plain,text/*"
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
