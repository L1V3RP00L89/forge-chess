import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { RepertoireSide } from '../engine/repertoire'
import type { StoredDrillUnit } from '../hooks/useRepertoireDb'
import { IconChevronRight, IconStop } from './icons'
import './RepertoireDrillView.css'

type Props = {
    ownerColor: RepertoireSide
    rootFen: string
    units: StoredDrillUnit[]
    onRecordResult: (unitId: number, correct: boolean) => void
    /** First-ever exposure to a unit: a walkthrough, not a graded test (see useRepertoireDb.markIntroduced). */
    onIntroduced: (unitId: number) => void
    onExit: () => void
}

type Feedback = { correct: boolean; expectedSan: string; comment?: string } | null

// Only a correct move with nothing to read auto-advances — anything with a
// comment, or any miss (which always shows the correct move), waits for the
// user to hit Continue instead of racing a timer.
const AUTOPLAY_DELAY_MS = 350

// Repertoire data comes from arbitrary user-uploaded PGN files, not a trusted
// source — a bad disambiguation or a subtle export quirk upstream can produce
// a stored uci that isn't actually legal once replayed here. chess.js throws
// on an illegal move rather than returning null, so every call site needs to
// survive that without taking the whole drill screen down.
function playUci(chess: Chess, uci: string) {
    try {
        return chess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.slice(4) || undefined })
    } catch (error) {
        console.warn('Repertoire drill: stored move was illegal at replay time', uci, error)
        return null
    }
}

// unitIndex and stepIndex must always change together, in one render — a
// separate setStepIndex(0) fired from an effect keyed on "unit changed"
// leaves a render in between where stepIndex still belongs to the *previous*
// unit's step count while `unit` already points at the new one. If the new
// unit happens to have more steps than the old one's last index, that stale
// index is still in-bounds, so React renders a real (but wrong) step from
// partway through the new unit — and the auto-play effect below dutifully
// tries to play its move against a board that's only been set up for step 0.
// That's the exact "stored move was illegal at replay time" case this was
// producing. One state object, updated atomically, makes that render
// impossible rather than papering over its symptom.
type Cursor = { unitIndex: number; stepIndex: number }

export function RepertoireDrillView({ ownerColor, rootFen, units, onRecordResult, onIntroduced, onExit }: Props) {
    const [cursor, setCursor] = useState<Cursor>({ unitIndex: 0, stepIndex: 0 })
    const { unitIndex, stepIndex } = cursor
    const [fen, setFen] = useState(rootFen)
    const [feedback, setFeedback] = useState<Feedback>(null)
    const [locked, setLocked] = useState(false)
    const chessRef = useRef(new Chess(rootFen))
    const mistakeInUnitRef = useRef(false)
    const pendingContinueRef = useRef<(() => void) | null>(null)
    const [awaitingContinue, setAwaitingContinue] = useState(false)

    const unit = units[unitIndex]
    // A unit nobody has ever drilled is a walkthrough (see markIntroduced): the
    // correct move is shown, not tested, so a brand-new import doesn't quiz the
    // user cold on hundreds of lines they've never once seen.
    const isLearnMode = unit ? unit.reviewCount === 0 : false

    const setupToStep = useCallback((targetUnit: StoredDrillUnit): boolean => {
        const chess = new Chess(rootFen)
        for (const uci of targetUnit.setupUci) {
            if (!playUci(chess, uci)) return false
        }
        chessRef.current = chess
        setFen(chess.fen())
        return true
    }, [rootFen])

    // The only place unitIndex ever changes — always paired with resetting
    // stepIndex to 0 in the same setCursor call, so unit and step index can
    // never be observed out of sync with each other (see the Cursor comment above).
    const goToNextUnitOrExit = useCallback(() => {
        setCursor(current =>
            current.unitIndex + 1 < units.length
                ? { unitIndex: current.unitIndex + 1, stepIndex: 0 }
                : current,
        )
    }, [units.length])

    useEffect(() => {
        mistakeInUnitRef.current = false
        pendingContinueRef.current = null
        setFeedback(null)
        setLocked(false)
        setAwaitingContinue(false)
        if (unit && !setupToStep(unit)) {
            // Setup itself is broken — nothing usable in this unit at all.
            if (unitIndex + 1 < units.length) {
                goToNextUnitOrExit()
            } else {
                onExit()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unit, setupToStep])

    const currentStep = unit?.steps[stepIndex]
    const boardOrientation = ownerColor === 'w' ? 'white' : 'black'

    const advance = useCallback(() => {
        if (!unit) return
        if (stepIndex + 1 < unit.steps.length) {
            setCursor(current => ({ ...current, stepIndex: current.stepIndex + 1 }))
            setFeedback(null)
            setLocked(false)
            return
        }
        if (isLearnMode) {
            onIntroduced(unit.id)
        } else {
            onRecordResult(unit.id, !mistakeInUnitRef.current)
        }
        if (unitIndex + 1 < units.length) {
            goToNextUnitOrExit()
        } else {
            onExit()
        }
    }, [goToNextUnitOrExit, isLearnMode, onExit, onIntroduced, onRecordResult, stepIndex, unit, unitIndex, units.length])

    // A stored move that turns out to be illegal at replay time means this
    // unit's data is bad (see playUci) — nothing to test or teach, so move on
    // without grading or marking it introduced rather than getting stuck.
    const skipToNextUnit = useCallback(() => {
        if (unitIndex + 1 < units.length) {
            goToNextUnitOrExit()
        } else {
            onExit()
        }
    }, [goToNextUnitOrExit, onExit, unitIndex, units.length])

    // Learn mode: play the step's move for the user as soon as it's current,
    // rather than waiting for a drag that was never going to be graded anyway.
    useEffect(() => {
        if (!isLearnMode || !currentStep || awaitingContinue) return
        const chess = chessRef.current
        const played = playUci(chess, currentStep.ownerUci)
        if (!played) {
            skipToNextUnit()
            return
        }
        setFen(chess.fen())
        setFeedback({ correct: true, expectedSan: currentStep.ownerSan, comment: currentStep.comment })
        setLocked(true)
        pendingContinueRef.current = () => {
            if (currentStep.opponentReplyUci) playUci(chess, currentStep.opponentReplyUci)
            setFen(chess.fen())
            advance()
        }
        setAwaitingContinue(true)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLearnMode, currentStep, unitIndex, stepIndex])

    const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
        if (isLearnMode || locked || !currentStep || !targetSquare) return false

        const chess = chessRef.current
        let move
        try {
            move = chess.move({ from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' })
        } catch {
            return false
        }
        if (!move) return false

        const playedUci = `${move.from}${move.to}${move.promotion ?? ''}`
        const correct = playedUci === currentStep.ownerUci
        const playOpponentReply = () => {
            if (currentStep.opponentReplyUci) playUci(chess, currentStep.opponentReplyUci)
        }

        if (!correct) {
            chess.undo()
            setFen(chess.fen())
            mistakeInUnitRef.current = true
            setFeedback({ correct: false, expectedSan: currentStep.ownerSan, comment: currentStep.comment })
            setLocked(true)
            pendingContinueRef.current = () => {
                const forced = playUci(chess, currentStep.ownerUci)
                if (forced) playOpponentReply()
                setFen(chess.fen())
                advance()
            }
            setAwaitingContinue(true)
            return true
        }

        setFen(chess.fen())
        setFeedback({ correct: true, expectedSan: currentStep.ownerSan, comment: currentStep.comment })
        setLocked(true)

        if (currentStep.comment) {
            pendingContinueRef.current = () => {
                playOpponentReply()
                setFen(chess.fen())
                advance()
            }
            setAwaitingContinue(true)
            return true
        }

        window.setTimeout(() => {
            playOpponentReply()
            setFen(chess.fen())
            advance()
        }, AUTOPLAY_DELAY_MS)
        return true
    }, [advance, currentStep, isLearnMode, locked])

    const handleContinue = useCallback(() => {
        const run = pendingContinueRef.current
        pendingContinueRef.current = null
        setAwaitingContinue(false)
        run?.()
    }, [])

    const sourceLabel = useMemo(() => unit?.sourceLabels[0] ?? '', [unit])

    if (!unit) {
        return (
            <div className="repertoire-drill-empty">
                <p>Nothing due right now — nice work.</p>
                <button type="button" onClick={onExit}>Back to Repertoires</button>
            </div>
        )
    }

    return (
        <div className="repertoire-drill">
            <div className="repertoire-drill-status">
                <span>
                    {isLearnMode ? 'New line' : `Line ${unitIndex + 1} of ${units.length}`}
                    {sourceLabel ? ` · ${sourceLabel}` : ''}
                </span>
                <button type="button" className="repertoire-drill-exit" onClick={onExit} aria-label="Exit drill">
                    <IconStop /> Exit
                </button>
            </div>
            <div className="repertoire-drill-board">
                <Chessboard
                    options={{
                        position: fen,
                        boardOrientation,
                        onPieceDrop,
                        allowDragging: !locked && !isLearnMode,
                    }}
                />
            </div>
            {feedback && (
                <div className={`repertoire-drill-feedback ${isLearnMode ? 'learn' : feedback.correct ? 'correct' : 'incorrect'}`}>
                    <p className="repertoire-drill-feedback-headline">
                        {isLearnMode
                            ? `Study this move: ${feedback.expectedSan}`
                            : feedback.correct ? 'Correct' : `Not quite — the line plays ${feedback.expectedSan}`}
                    </p>
                    {feedback.comment && <p className="repertoire-drill-feedback-comment">{feedback.comment}</p>}
                    {awaitingContinue && (
                        <button type="button" className="repertoire-drill-continue" onClick={handleContinue}>
                            Continue <IconChevronRight />
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
