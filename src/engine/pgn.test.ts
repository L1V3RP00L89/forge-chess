import { describe, expect, it } from 'vitest'
import type { GameNode } from '../hooks/useGameTree'
import { Chess } from 'chess.js'
import { exportAnnotatedPgn, rootFenFromPgnHeaders } from './pgn'

describe('PGN export helpers', () => {
  it('exports FEN roots with setup headers and black-to-move numbering', () => {
    const game = new Chess()
    game.move('e4')
    const rootFen = game.fen()
    const move = game.move('c5')!
    const afterFen = game.fen()
    const mainLine = [
      {
        id: 'root',
        fen: rootFen,
        move: null,
        san: '',
        uci: '',
        parent: null,
        children: ['n1'],
      },
      {
        id: 'n1',
        fen: afterFen,
        move,
        san: move.san,
        uci: 'c7c5',
        parent: 'root',
        children: [],
      },
    ] as unknown as GameNode[]

    const pgn = exportAnnotatedPgn(mainLine, new Map(), { Result: '*' })
    const loader = new Chess()
    loader.loadPgn(pgn)

    expect(pgn).toContain('[Site "Web Chess"]')
    expect(pgn).toContain('[SetUp "1"]')
    expect(pgn).toContain(`[FEN "${rootFen}"]`)
    expect(pgn).toContain('1... c5')
    expect(rootFenFromPgnHeaders(loader.getHeaders())).toBe(rootFen)
    expect(loader.history()).toEqual(['c5'])
  })

  it('rejects PGN FEN headers with impossible adjacent kings', () => {
    expect(() => rootFenFromPgnHeaders({
      FEN: '8/8/8/8/8/8/7K/6k1 w - - 0 1',
    })).toThrow('Invalid FEN king placement')
  })

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

  it('omits non-finite eval annotations from exported PGN', () => {
    const fenAfterWhiteMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'
    const mainLine = [
      {
        id: 'root',
        fen: new Chess().fen(),
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
      new Map([[fenAfterWhiteMove, { cp: Number.NaN, mate: Number.POSITIVE_INFINITY }]]),
      { Result: '*' },
    )

    expect(pgn).toContain('1. e4')
    expect(pgn).not.toContain('%eval')
    expect(pgn).not.toContain('NaN')
    expect(pgn).not.toContain('Infinity')
  })

  it('exports reviewed move quality labels as PGN comments', () => {
    const game = new Chess()
    const move = game.move('e4')!
    const fenAfterWhiteMove = game.fen()
    const mainLine = [
      {
        id: 'root',
        fen: new Chess().fen(),
        move: null,
        san: '',
        uci: '',
        parent: null,
        children: ['n1'],
      },
      {
        id: 'n1',
        fen: fenAfterWhiteMove,
        move,
        san: move.san,
        uci: 'e2e4',
        parent: 'root',
        children: [],
        quality: 'best',
      },
    ] as unknown as GameNode[]

    const pgn = exportAnnotatedPgn(
      mainLine,
      new Map([[fenAfterWhiteMove, { cp: -12 }]]),
      { Result: '*' },
    )
    const loader = new Chess()
    loader.loadPgn(pgn)

    expect(pgn).toContain('{ [%eval 0.12]; Best }')
    expect(loader.history()).toEqual(['e4'])
  })

  it('exports best-move alternatives in review comments', () => {
    const game = new Chess()
    const rootFen = game.fen()
    const move = game.move('d4')!
    const fenAfterMove = game.fen()
    const mainLine = [
      {
        id: 'root',
        fen: rootFen,
        move: null,
        san: '',
        uci: '',
        parent: null,
        children: ['n1'],
      },
      {
        id: 'n1',
        fen: fenAfterMove,
        move,
        san: move.san,
        uci: 'd2d4',
        parent: 'root',
        children: [],
        quality: 'inaccuracy',
      },
    ] as unknown as GameNode[]

    const pgn = exportAnnotatedPgn(
      mainLine,
      new Map([
        [rootFen, { cp: 0, bestMove: 'e2e4' }],
        [fenAfterMove, { cp: 100 }],
      ]),
      { Result: '*' },
    )
    const loader = new Chess()
    loader.loadPgn(pgn)

    expect(pgn).toContain('{ [%eval -1.00]; Best e4; Inaccuracy }')
    expect(loader.history()).toEqual(['d4'])
  })

  it('sanitizes tag values and ignores invalid tag names when exporting', () => {
    const mainLine = [
      {
        id: 'root',
        fen: new Chess().fen(),
        move: null,
        san: '',
        uci: '',
        parent: null,
        children: [],
      },
    ] as unknown as GameNode[]

    const pgn = exportAnnotatedPgn(mainLine, new Map(), {
      Event: 'Queen "Sacrifice" \\ Study\nFinal',
      Result: '1-0"\n[Injected "1"]',
      'Bad]Tag': 'ignored',
    })
    const loader = new Chess()
    loader.loadPgn(pgn)

    expect(pgn).toContain('[Event "Queen \'Sacrifice\' \\ Study Final"]')
    expect(pgn).toContain('[Result "*"]')
    expect(pgn).not.toContain('[Injected "1"]')
    expect(pgn).not.toContain('Bad]Tag')
    expect(loader.getHeaders().Event).toBe('Queen \'Sacrifice\' \\ Study Final')
    expect(loader.getHeaders().Result).toBe('*')
  })
})
