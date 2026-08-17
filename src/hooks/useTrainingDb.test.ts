import { describe, expect, it } from 'vitest'
import { derivePlayModeResult, normalizeJournalField } from './useTrainingDb'

describe('derivePlayModeResult', () => {
  it('credits the side not to move when checkmated', () => {
    expect(derivePlayModeResult({ isCheckmate: true, isStalemate: false, isDraw: false, turn: 'w' })).toBe('0-1')
    expect(derivePlayModeResult({ isCheckmate: true, isStalemate: false, isDraw: false, turn: 'b' })).toBe('1-0')
  })

  it('reports a draw for stalemate or any other draw condition', () => {
    expect(derivePlayModeResult({ isCheckmate: false, isStalemate: true, isDraw: false, turn: 'w' })).toBe('1/2-1/2')
    expect(derivePlayModeResult({ isCheckmate: false, isStalemate: false, isDraw: true, turn: 'b' })).toBe('1/2-1/2')
  })

  it('returns null when the game is not actually over', () => {
    expect(derivePlayModeResult({ isCheckmate: false, isStalemate: false, isDraw: false, turn: 'w' })).toBeNull()
  })
})

describe('normalizeJournalField', () => {
  it('trims whitespace', () => {
    expect(normalizeJournalField('  good rook lift  ')).toBe('good rook lift')
  })

  it('converts blank or whitespace-only input to null', () => {
    expect(normalizeJournalField('')).toBeNull()
    expect(normalizeJournalField('   ')).toBeNull()
  })
})
