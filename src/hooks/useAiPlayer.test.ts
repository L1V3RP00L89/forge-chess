import { describe, expect, it } from 'vitest'
import { aiDifficultyCommands, consumeStoppedSearchBestMove } from './useAiPlayer'

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
})
