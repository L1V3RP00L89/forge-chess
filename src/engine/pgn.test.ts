import { describe, expect, it } from 'vitest'
import type { GameNode } from '../hooks/useGameTree'
import { exportAnnotatedPgn } from './pgn'

describe('PGN export helpers', () => {
  it('preserves mate distance from side-to-move engine scores', () => {
    const fenAfterWhiteMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const mainLine = [
      {
        id: 'root',
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        move: null,
        san: '',
        uci: '',
        parent: null,
        children: ['n1'],
      },
      {
        id: 'n1',
        fen: fenAfterWhiteMove,
        move: {},
        san: 'e4',
        uci: 'e2e4',
        parent: 'root',
        children: [],
      },
    ] as unknown as GameNode[]

    const pgn = exportAnnotatedPgn(
      mainLine,
      new Map([[fenAfterWhiteMove, { cp: -10000, mate: -3 }]]),
      { Result: '*' },
    )

    expect(pgn).toContain('{ [%eval #3] }')
  })
})
