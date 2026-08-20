import { describe, expect, it } from 'vitest'
import { mapMissedTacticRow } from './useMissedTacticsDb'

describe('mapMissedTacticRow', () => {
    it('maps a missed-tactic row', () => {
        expect(mapMissedTacticRow({
            id: 1,
            game_id: null,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            best_move: 'e2e4',
            motif: null,
            created_at: '2026-08-20T12:00:00.000Z',
            next_review_at: '2026-08-20T12:00:00.000Z',
            review_count: 0,
            solved_streak: 0,
        })).toEqual({
            id: 1,
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            bestMoveUci: 'e2e4',
            motif: null,
            nextReviewAt: '2026-08-20T12:00:00.000Z',
            reviewCount: 0,
            solvedStreak: 0,
        })
    })

    it('carries a motif through when present', () => {
        const mapped = mapMissedTacticRow({
            id: 2,
            game_id: 7,
            fen: 'startpos',
            best_move: 'g1f3',
            motif: 'fork',
            created_at: '2026-08-20T12:00:00.000Z',
            next_review_at: '2026-08-20T12:00:00.000Z',
            review_count: 2,
            solved_streak: 1,
        })
        expect(mapped.motif).toBe('fork')
    })
})
