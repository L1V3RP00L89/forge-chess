import { describe, expect, it } from 'vitest'
import { selectCoachBestMove } from './coach'

describe('coach move selection', () => {
  it('prioritizes live engine and cloud moves over tablebase fallbacks', () => {
    expect(selectCoachBestMove({
      engine: 'e2e4',
      cloud: 'd2d4',
      last: 'g1f3',
      tablebase: 'a7a8q',
    })).toBe('e2e4')

    expect(selectCoachBestMove({
      cloud: 'd2d4',
      tablebase: 'a7a8q',
    })).toBe('d2d4')
  })

  it('uses the exact tablebase move when no engine move is available', () => {
    expect(selectCoachBestMove({
      engine: null,
      cloud: null,
      last: null,
      tablebase: 'G6G1',
    })).toBe('g6g1')
  })

  it('ignores invalid move candidates', () => {
    expect(selectCoachBestMove({
      engine: '(none)',
      cloud: 'not-a-move',
      tablebase: 'g6g1',
    })).toBe('g6g1')
  })
})
