import { describe, expect, it } from 'vitest'
import { derivePlayModeResult, mapSavedGameRow, normalizeJournalField } from './useTrainingDb'

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

describe('mapSavedGameRow', () => {
  it('maps a row with a journal entry and a result', () => {
    expect(mapSavedGameRow({ id: 3, played_at: '2026-08-18T12:00:00.000Z', pgn: '1. e4 *', result: '1-0', has_journal: 1 })).toEqual({
      id: 3,
      playedAt: '2026-08-18T12:00:00.000Z',
      pgn: '1. e4 *',
      result: '1-0',
      hasJournalEntry: true,
    })
  })

  it('maps a null result and no journal entry', () => {
    expect(mapSavedGameRow({ id: 4, played_at: '2026-08-18T12:00:00.000Z', pgn: '1. e4 *', result: null, has_journal: 0 })).toEqual({
      id: 4,
      playedAt: '2026-08-18T12:00:00.000Z',
      pgn: '1. e4 *',
      result: null,
      hasJournalEntry: false,
    })
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
