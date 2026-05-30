import { Chess } from 'chess.js'
import { describe, expect, it } from 'vitest'
import { buildReviewRows, summarizeReview } from './analysis'

describe('review analysis helpers', () => {
  it('labels reviewed moves from side-to-move centipawn deltas', () => {
    const game = new Chess()
    const rootFen = game.fen()
    const move = game.move('e4')
    const afterFen = game.fen()

    const rows = buildReviewRows(
      [move],
      new Map([
        [rootFen, { cp: 30 }],
        [afterFen, { cp: -20 }],
      ]),
      rootFen,
    )

    expect(rows).toMatchObject([
      {
        ply: 1,
        moveNumber: 1,
        san: 'e4',
        uci: 'e2e4',
        deltaCp: -10,
        quality: 'best',
      },
    ])
    expect(summarizeReview(rows)).toMatchObject({ best: 1, pending: 0 })
  })

  it('marks rows pending when either side of the move is missing an evaluation', () => {
    const game = new Chess()
    const rootFen = game.fen()
    const move = game.move('d4')

    const rows = buildReviewRows([move], new Map([[rootFen, { cp: 15 }]]), rootFen)

    expect(rows[0]).toMatchObject({
      san: 'd4',
      uci: 'd2d4',
      quality: 'pending',
    })
    expect(summarizeReview(rows).pending).toBe(1)
  })
})
