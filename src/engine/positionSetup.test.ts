import { describe, expect, it } from 'vitest'
import { type Square } from 'chess.js'
import {
  createEmptyPositionSetup,
  createStartingPositionSetup,
  normalizeCastlingRights,
  parsePositionSetupFen,
  positionSetupToFen,
  setupPieceGlyph,
  setupPieceLabel,
  updateSetupSquare,
  updateSetupTurn,
} from './positionSetup'

describe('position setup helpers', () => {
  it('round-trips the starting position', () => {
    const setup = createStartingPositionSetup()

    expect(positionSetupToFen(setup)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  })

  it('parses piece placement and normalizes counters', () => {
    const setup = parsePositionSetupFen('8/8/8/8/8/8/2K5/6k1 b - - 37 82')

    expect(setup?.pieces.c2).toBe('K')
    expect(setup?.pieces.g1).toBe('k')
    expect(setup?.turn).toBe('b')
    expect(positionSetupToFen(setup!)).toBe('8/8/8/8/8/8/2K5/6k1 b - - 37 82')
  })

  it('rejects malformed board placement', () => {
    expect(parsePositionSetupFen('9/8/8/8/8/8/8/8 w - - 0 1')).toBeNull()
    expect(parsePositionSetupFen('8/8/8/8/8/8/8 w - - 0 1')).toBeNull()
    expect(parsePositionSetupFen('8/8/8/8/8/8/8/X7 w - - 0 1')).toBeNull()
  })

  it('updates squares and side to move', () => {
    const withKings = updateSetupSquare(updateSetupSquare(createEmptyPositionSetup(), 'e1' as Square, 'K'), 'e8' as Square, 'k')
    const blackToMove = updateSetupTurn(withKings, 'b')

    expect(positionSetupToFen(blackToMove)).toBe('4k3/8/8/8/8/8/8/4K3 b - - 0 1')
    expect(positionSetupToFen(updateSetupSquare(blackToMove, 'e8' as Square, null))).toBe('8/8/8/8/8/8/8/4K3 b - - 0 1')
  })

  it('normalizes castling rights', () => {
    expect(normalizeCastlingRights('qKQkK')).toBe('KQkq')
    expect(normalizeCastlingRights('abc')).toBe('-')
    expect(normalizeCastlingRights('-')).toBe('-')
  })

  it('provides stable piece labels and glyphs', () => {
    expect(setupPieceLabel('Q')).toBe('White queen')
    expect(setupPieceGlyph('q')).toBe('♛')
  })
})
