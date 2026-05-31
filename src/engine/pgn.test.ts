import { describe, expect, it } from 'vitest'
import type { GameNode } from '../hooks/useGameTree'
import { Chess } from 'chess.js'
import { exportAnnotatedPgn, flattenPgnMainLine, parsePgnMoveTree, rootFenFromPgnHeaders } from './pgn'

function makeNode(
  id: string,
  fen: string,
  move: GameNode['move'],
  parent: string | null,
  children: string[] = [],
  quality?: GameNode['quality'],
): GameNode {
  return {
    id,
    fen,
    move,
    san: move?.san ?? '',
    uci: move ? `${move.from}${move.to}${move.promotion ?? ''}` : '',
    parent,
    children,
    quality,
  } as GameNode
}

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

  it('exports analysis tree variations from the game tree snapshot', () => {
    const rootFen = new Chess().fen()

    const e4Game = new Chess(rootFen)
    const e4Move = e4Game.move('e4')!
    const e4Fen = e4Game.fen()

    const e5Game = new Chess(e4Fen)
    const e5Move = e5Game.move('e5')!
    const e5Fen = e5Game.fen()

    const nf3Game = new Chess(e5Fen)
    const nf3Move = nf3Game.move('Nf3')!
    const nf3Fen = nf3Game.fen()

    const d4Game = new Chess(rootFen)
    const d4Move = d4Game.move('d4')!
    const d4Fen = d4Game.fen()

    const c5Game = new Chess(e4Fen)
    const c5Move = c5Game.move('c5')!
    const c5Fen = c5Game.fen()

    const root = makeNode('root', rootFen, null, null, ['e4', 'd4'])
    const e4 = makeNode('e4', e4Fen, e4Move, 'root', ['e5', 'c5'])
    const e5 = makeNode('e5', e5Fen, e5Move, 'e4', ['nf3'])
    const nf3 = makeNode('nf3', nf3Fen, nf3Move, 'e5')
    const d4 = makeNode('d4', d4Fen, d4Move, 'root', [], 'mistake')
    const c5 = makeNode('c5', c5Fen, c5Move, 'e4')
    const nodes = new Map([
      [root.id, root],
      [e4.id, e4],
      [e5.id, e5],
      [nf3.id, nf3],
      [d4.id, d4],
      [c5.id, c5],
    ])

    const pgn = exportAnnotatedPgn(
      [root, e4, e5, nf3],
      new Map([[d4Fen, { cp: 24 }]]),
      { Result: '*' },
      nodes,
    )
    const loader = new Chess()
    loader.loadPgn(pgn)

    expect(pgn).toContain('1. e4 (1. d4 { [%eval -0.24]; Mistake }) 1... e5')
    expect(pgn).toContain('(1... c5)')
    expect(loader.history()).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('parses PGN variations into a nested import tree', () => {
    const parsed = parsePgnMoveTree(`
[Event "Branch study"]
[Result "*"]

1. e4 (1. d4 d5) e5 (1... c5) 2. Nf3 *
`)
    const mainLine = flattenPgnMainLine(parsed.moves)

    expect(parsed.rootFen).toBe(new Chess().fen())
    expect(parsed.moves.map(entry => entry.move.san)).toEqual(['e4', 'd4'])
    expect(parsed.moves[0]?.children?.map(entry => entry.move.san)).toEqual(['e5', 'c5'])
    expect(parsed.moves[1]?.children?.map(entry => entry.move.san)).toEqual(['d5'])
    expect(mainLine.map(entry => entry.move.san)).toEqual(['e4', 'e5', 'Nf3'])
    const replay = new Chess()
    for (const entry of mainLine) replay.move(entry.move)
    expect(mainLine.at(-1)?.fen).toBe(replay.fen())
  })
})
