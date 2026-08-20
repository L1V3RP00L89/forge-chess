import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { RepertoireSide } from '../engine/repertoire'
import type { StoredDrillUnit } from '../hooks/useRepertoireDb'
import { IconStop } from './icons'
import './RepertoireDrillView.css'

type Props = {
    ownerColor: RepertoireSide
    rootFen: string
    units: StoredDrillUnit[]
    onRecordResult: (unitId: number, correct: boolean) => void
    onExit: () => void
}

type Feedback = { correct: boolean; expectedSan: string; comment?: string } | null

const AUTOPLAY_DELAY_MS = 350
const CORRECTION_DELAY_MS = 1100

export function RepertoireDrillView({ ownerColor, rootFen, units, onRecordResult, onExit }: Props) {
    const [unitIndex, setUnitIndex] = useState(0)
    const [stepIndex, setStepIndex] = useState(0)
    const [fen, setFen] = useState(rootFen)
    const [feedback, setFeedback] = useState<Feedback>(null)
    const [locked, setLocked] = useState(false)
    const chessRef = useRef(new Chess(rootFen))
    const mistakeInUnitRef = useRef(false)

    const unit = units[unitIndex]

    const setupToStep = useCallback((targetUnit: StoredDrillUnit) => {
        const chess = new Chess(rootFen)
        for (const uci of targetUnit.setupUci) {
            chess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.slice(4) || undefined })
        }
        chessRef.current = chess
        setFen(chess.fen())
    }, [rootFen])

    useEffect(() => {
        mistakeInUnitRef.current = false
        setStepIndex(0)
        setFeedback(null)
        setLocked(false)
        if (unit) setupToStep(unit)
    }, [unit, setupToStep])

    const currentStep = unit?.steps[stepIndex]
    const boardOrientation = ownerColor === 'w' ? 'white' : 'black'

    const advance = useCallback(() => {
        if (!unit) return
        if (stepIndex + 1 < unit.steps.length) {
            setStepIndex(index => index + 1)
            setFeedback(null)
            setLocked(false)
            return
        }
        onRecordResult(unit.id, !mistakeInUnitRef.current)
        if (unitIndex + 1 < units.length) {
            setUnitIndex(index => index + 1)
        } else {
            onExit()
        }
    }, [onExit, onRecordResult, stepIndex, unit, unitIndex, units.length])

    const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
        if (locked || !currentStep || !targetSquare) return false

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

        if (!correct) {
            chess.undo()
            setFen(chess.fen())
            mistakeInUnitRef.current = true
            setFeedback({ correct: false, expectedSan: currentStep.ownerSan, comment: currentStep.comment })
            setLocked(true)
            window.setTimeout(() => {
                const forced = chess.move({
                    from: currentStep.ownerUci.slice(0, 2) as Square,
                    to: currentStep.ownerUci.slice(2, 4) as Square,
                    promotion: currentStep.ownerUci.slice(4) || undefined,
                })
                if (forced && currentStep.opponentReplyUci) {
                    chess.move({
                        from: currentStep.opponentReplyUci.slice(0, 2) as Square,
                        to: currentStep.opponentReplyUci.slice(2, 4) as Square,
                        promotion: currentStep.opponentReplyUci.slice(4) || undefined,
                    })
                }
                setFen(chess.fen())
                advance()
            }, CORRECTION_DELAY_MS)
            return true
        }

        setFen(chess.fen())
        setFeedback({ correct: true, expectedSan: currentStep.ownerSan, comment: currentStep.comment })
        setLocked(true)
        window.setTimeout(() => {
            if (currentStep.opponentReplyUci) {
                chess.move({
                    from: currentStep.opponentReplyUci.slice(0, 2) as Square,
                    to: currentStep.opponentReplyUci.slice(2, 4) as Square,
                    promotion: currentStep.opponentReplyUci.slice(4) || undefined,
                })
                setFen(chess.fen())
            }
            advance()
        }, currentStep.comment ? CORRECTION_DELAY_MS : AUTOPLAY_DELAY_MS)
        return true
    }, [advance, currentStep, locked])

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
                <span>Line {unitIndex + 1} of {units.length}{sourceLabel ? ` · ${sourceLabel}` : ''}</span>
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
                        allowDragging: !locked,
                    }}
                />
            </div>
            {feedback && (
                <div className={`repertoire-drill-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                    <p className="repertoire-drill-feedback-headline">
                        {feedback.correct ? 'Correct' : `Not quite — the line plays ${feedback.expectedSan}`}
                    </p>
                    {feedback.comment && <p className="repertoire-drill-feedback-comment">{feedback.comment}</p>}
                </div>
            )}
        </div>
    )
}
