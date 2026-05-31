import { describe, expect, it } from 'vitest'
import { hasLegalKingPlacement } from './fen'

describe('FEN validation helpers', () => {
  it('accepts separated kings and rejects adjacent kings', () => {
    expect(hasLegalKingPlacement('8/8/8/8/8/8/4K3/6k1 w - - 0 1')).toBe(true)
    expect(hasLegalKingPlacement('8/8/8/8/8/8/7K/6k1 w - - 0 1')).toBe(false)
  })

  it('rejects positions without both kings', () => {
    expect(hasLegalKingPlacement('8/8/8/8/8/8/4K3/8 w - - 0 1')).toBe(false)
    expect(hasLegalKingPlacement('8/8/8/8/8/8/8/6k1 w - - 0 1')).toBe(false)
  })
})
