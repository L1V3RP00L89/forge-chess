import { describe, expect, it } from 'vitest'
import { missedTacticFromEvent } from './missedTactics'
import type { CoachRevealEvent } from './coachEvents'

const base: CoachRevealEvent = {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    bestMoveUci: 'e2e4',
    tier: 3,
    outcome: 'missed',
}

describe('missedTacticFromEvent', () => {
    it('captures a tier-3 missed outcome', () => {
        expect(missedTacticFromEvent(base)).toEqual({ fen: base.fen, bestMoveUci: 'e2e4' })
    })

    it('ignores found outcomes', () => {
        expect(missedTacticFromEvent({ ...base, outcome: 'found' })).toBeNull()
    })

    it('ignores unrated outcomes, even at tier 3', () => {
        expect(missedTacticFromEvent({ ...base, outcome: 'unrated' })).toBeNull()
    })

    it('ignores a miss recorded below tier 3', () => {
        expect(missedTacticFromEvent({ ...base, tier: 2 })).toBeNull()
    })

    it('ignores a missing best move', () => {
        expect(missedTacticFromEvent({ ...base, bestMoveUci: null })).toBeNull()
    })
})
