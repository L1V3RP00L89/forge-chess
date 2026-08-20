import { useCallback } from 'react'
import { query } from '../db/sqliteClient'
import type { SqliteRow } from '../db/sqliteProtocol'
import { computeNextReview } from '../engine/spacedRepetition'

export type StoredMissedTactic = {
    id: number
    fen: string
    bestMoveUci: string
    motif: string | null
    nextReviewAt: string
    reviewCount: number
    solvedStreak: number
}

export function mapMissedTacticRow(row: SqliteRow): StoredMissedTactic {
    return {
        id: Number(row.id),
        fen: String(row.fen),
        bestMoveUci: String(row.best_move),
        motif: row.motif == null ? null : String(row.motif),
        nextReviewAt: String(row.next_review_at),
        reviewCount: Number(row.review_count),
        solvedStreak: Number(row.solved_streak),
    }
}

export function useMissedTacticsDb() {
    // One row per position: a repeat miss on a FEN already queued just means
    // it's still due, not a second entry to drill twice.
    const recordMiss = useCallback(async (fen: string, bestMoveUci: string, motif: string | null = null): Promise<void> => {
        try {
            const existing = await query('SELECT id FROM missed_tactics WHERE fen = ?', [fen])
            if (existing[0]) return
            await query(
                'INSERT INTO missed_tactics (game_id, fen, best_move, motif, created_at, next_review_at, review_count, solved_streak) VALUES (NULL, ?, ?, ?, ?, ?, 0, 0)',
                [fen, bestMoveUci, motif, new Date().toISOString(), new Date().toISOString()],
            )
        } catch (error) {
            console.warn('Failed to record missed tactic', error)
        }
    }, [])

    const countDue = useCallback(async (): Promise<number> => {
        try {
            const rows = await query('SELECT COUNT(*) AS n FROM missed_tactics WHERE next_review_at <= ?', [new Date().toISOString()])
            return Number(rows[0]?.n ?? 0)
        } catch (error) {
            console.warn('Failed to count due missed tactics', error)
            return 0
        }
    }, [])

    const listDue = useCallback(async (limit = 20): Promise<StoredMissedTactic[]> => {
        try {
            const rows = await query(
                'SELECT * FROM missed_tactics WHERE next_review_at <= ? ORDER BY next_review_at ASC, id ASC LIMIT ?',
                [new Date().toISOString(), limit],
            )
            return rows.map(mapMissedTacticRow)
        } catch (error) {
            console.warn('Failed to list due missed tactics', error)
            return []
        }
    }, [])

    const recordDrillResult = useCallback(async (id: number, correct: boolean): Promise<void> => {
        try {
            const rows = await query('SELECT review_count, solved_streak FROM missed_tactics WHERE id = ?', [id])
            const row = rows[0]
            if (!row) return
            const next = computeNextReview(
                { reviewCount: Number(row.review_count), solvedStreak: Number(row.solved_streak) },
                correct,
            )
            await query(
                'UPDATE missed_tactics SET next_review_at = ?, review_count = ?, solved_streak = ? WHERE id = ?',
                [next.nextReviewAt, next.reviewCount, next.solvedStreak, id],
            )
        } catch (error) {
            console.warn('Failed to record missed-tactic drill result', error)
        }
    }, [])

    return { recordMiss, countDue, listDue, recordDrillResult }
}
