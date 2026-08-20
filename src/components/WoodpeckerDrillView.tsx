import { useCallback, useEffect, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import type { StoredMissedTactic } from '../hooks/useMissedTacticsDb'
import { IconStop } from './icons'
import './WoodpeckerDrillView.css'

type Props = {
    tactics: StoredMissedTactic[]
    onRecordResult: (id: number, correct: boolean) => void
    onExit: () => void
}

type Feedback = { correct: boolean; expectedSan: string } | null

function uciToSan(fen: string, uci: string): string | null {
    try {
        const chess = new Chess(fen)
        const move = chess.move({ from: uci.slice(0, 2) as Square, to: uci.slice(2, 4) as Square, promotion: uci.slice(4) || undefined })
        return move?.san ?? null
    } catch {
        return null
    }
}

// Each tactic is a single position, not a multi-move line: the user finds
// one move, gets graded, and moves to the next -- no setup runway or replies
// to auto-play like the M11 repertoire drill.
export function WoodpeckerDrillView({ tactics, onRecordResult, onExit }: Props) {
    const [index, setIndex] = useState(0)
    const [feedback, setFeedback] = useState<Feedback>(null)
    const tactic = tactics[index]
    const [fen, setFen] = useState(tactic?.fen ?? '')

    useEffect(() => {
        setFeedback(null)
        setFen(tactic?.fen ?? '')
    }, [tactic])

    const boardOrientation = tactic?.fen.includes(' b ') ? 'black' : 'white'

    const advance = useCallback(() => {
        setIndex(current => current + 1)
    }, [])

    const onPieceDrop = useCallback(({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
        if (!tactic || feedback || !targetSquare) return false
        const chess = new Chess(tactic.fen)
        let move
        try {
            move = chess.move({ from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' })
        } catch {
            return false
        }
        if (!move) return false

        const playedUci = `${move.from}${move.to}${move.promotion ?? ''}`
        const correct = playedUci === tactic.bestMoveUci
        const expectedSan = uciToSan(tactic.fen, tactic.bestMoveUci) ?? tactic.bestMoveUci
        if (correct) setFen(chess.fen())
        setFeedback({ correct, expectedSan })
        onRecordResult(tactic.id, correct)
        return correct
    }, [tactic, feedback, onRecordResult])

    if (!tactic) {
        return (
            <div className="woodpecker-drill-empty">
                <p>Queue cleared — nice work.</p>
                <button type="button" onClick={onExit}>Back to Training</button>
            </div>
        )
    }

    return (
        <div className="woodpecker-drill">
            <div className="woodpecker-drill-status">
                <span>Tactic {index + 1} of {tactics.length}</span>
                <button type="button" className="woodpecker-drill-exit" onClick={onExit} aria-label="Exit drill">
                    <IconStop /> Exit
                </button>
            </div>
            <div className="woodpecker-drill-board">
                <Chessboard
                    options={{
                        position: fen,
                        boardOrientation,
                        onPieceDrop,
                        allowDragging: !feedback,
                    }}
                />
            </div>
            {feedback && (
                <div className={`woodpecker-drill-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}>
                    <p className="woodpecker-drill-feedback-headline">
                        {feedback.correct ? 'Found it' : `Not quite — the move was ${feedback.expectedSan}`}
                    </p>
                    <button type="button" className="woodpecker-drill-continue" onClick={advance}>
                        Continue
                    </button>
                </div>
            )}
        </div>
    )
}
