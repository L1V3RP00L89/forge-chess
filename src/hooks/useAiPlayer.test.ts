import { describe, expect, it } from 'vitest'
import { addStoppedSearchBestMoveAck, aiDifficultyCommands, consumeStoppedSearchBestMove, pickBeginnerVarietyMove } from './useAiPlayer'

describe('AI difficulty UCI commands', () => {
    it('limits strength for beginner-friendly difficulty levels', () => {
        expect(aiDifficultyCommands(1)).toEqual([
            'setoption name UCI_LimitStrength value true',
            'setoption name UCI_Elo value 1320',
            'setoption name Skill Level value 0',
        ])

        expect(aiDifficultyCommands(4)).toEqual([
            'setoption name UCI_LimitStrength value true',
            'setoption name UCI_Elo value 1900',
            'setoption name Skill Level value 9',
        ])
    })

    it('turns off Stockfish strength limiting at maximum difficulty', () => {
        expect(aiDifficultyCommands(8)).toEqual([
            'setoption name UCI_LimitStrength value false',
            'setoption name Skill Level value 20',
        ])
        expect(aiDifficultyCommands(8).join(' ')).not.toContain('UCI_Elo')
    })
})

describe('AI stopped-search bestmove routing', () => {
    it('ignores exactly one bestmove for each stopped search acknowledgement', () => {
        expect(consumeStoppedSearchBestMove(0)).toEqual({ ignore: false, remaining: 0 })
        expect(consumeStoppedSearchBestMove(1)).toEqual({ ignore: true, remaining: 0 })
        expect(consumeStoppedSearchBestMove(3)).toEqual({ ignore: true, remaining: 2 })
    })

    it('normalizes malformed pending counts', () => {
        expect(consumeStoppedSearchBestMove(-1)).toEqual({ ignore: false, remaining: 0 })
        expect(consumeStoppedSearchBestMove(Number.NaN)).toEqual({ ignore: false, remaining: 0 })
        expect(consumeStoppedSearchBestMove(2.8)).toEqual({ ignore: true, remaining: 1 })
    })

    it('records one pending bestmove acknowledgement for every stopped search', () => {
        expect(addStoppedSearchBestMoveAck(0)).toBe(1)
        expect(addStoppedSearchBestMoveAck(-1)).toBe(1)
        expect(addStoppedSearchBestMoveAck(Number.NaN)).toBe(1)
        expect(addStoppedSearchBestMoveAck(2.8)).toBe(3)
    })
})

describe('AI beginner move variety', () => {
    it('occasionally returns legal non-engine moves for beginner levels', () => {
        const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

        expect(pickBeginnerVarietyMove(startFen, 1, () => 0)).toBe('a2a3')
        expect(pickBeginnerVarietyMove(startFen, 2, () => 0)).toBe('a2a3')
    })

    it('leaves stronger levels on pure Stockfish selection', () => {
        const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

        expect(pickBeginnerVarietyMove(startFen, 3, () => 0)).toBeNull()
        expect(pickBeginnerVarietyMove(startFen, 8, () => 0)).toBeNull()
    })

    it('skips variety when chance does not roll in or the FEN is invalid', () => {
        const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

        expect(pickBeginnerVarietyMove(startFen, 1, () => 0.99)).toBeNull()
        expect(pickBeginnerVarietyMove('not a fen', 1, () => 0)).toBeNull()
    })
})
