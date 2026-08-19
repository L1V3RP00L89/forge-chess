import { useCallback, useEffect, useRef } from 'react'
import { query } from '../db/sqliteClient'
import type { SqliteRow } from '../db/sqliteProtocol'

// Mirrors chess.js's isCheckmate/isStalemate/isDraw/turn surface without
// depending on the Chess type directly, so this is easy to unit test.
export type GameOverState = {
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  turn: 'w' | 'b'
}

// Only meaningful once the game is actually over; the side "to move" in a
// checkmate is the side that lost.
export function derivePlayModeResult(state: GameOverState): string | null {
  if (state.isCheckmate) return state.turn === 'w' ? '0-1' : '1-0'
  if (state.isStalemate || state.isDraw) return '1/2-1/2'
  return null
}

export type JournalEntryInput = {
  positive1: string
  positive2: string
  improve1: string
  improve2: string
}

export function normalizeJournalField(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export type SavedGameSummary = {
  id: number
  playedAt: string
  pgn: string
  result: string | null
  hasJournalEntry: boolean
}

// Row shaping pulled out as a pure function so it's testable without a live
// (worker-backed) database connection.
export function mapSavedGameRow(row: SqliteRow): SavedGameSummary {
  return {
    id: Number(row.id),
    playedAt: String(row.played_at),
    pgn: String(row.pgn),
    result: row.result == null ? null : String(row.result),
    hasJournalEntry: Number(row.has_journal) === 1,
  }
}

// Warms the OPFS worker (and applies SCHEMA_SQL) as soon as the app mounts,
// so the database is already open by the time the first game finishes.
// Best-effort only: OPFS isn't available everywhere (e.g. Safari private
// browsing), and a failure here must never break play or review.
export function useTrainingDb() {
  const warmedRef = useRef(false)

  useEffect(() => {
    if (warmedRef.current) return
    warmedRef.current = true
    query('SELECT 1').catch((error) => {
      console.warn('Training DB warm-up failed', error)
    })
  }, [])

  const recordGame = useCallback(async (pgn: string, result: string | null): Promise<number | null> => {
    try {
      await query('INSERT INTO games (played_at, pgn, result) VALUES (?, ?, ?)', [
        new Date().toISOString(),
        pgn,
        result,
      ])
      const rows = await query('SELECT last_insert_rowid() AS id')
      const id = rows[0]?.id
      return typeof id === 'number' ? id : null
    } catch (error) {
      console.warn('Failed to record game', error)
      return null
    }
  }, [])

  const recordJournalEntry = useCallback((gameId: number | null, entry: JournalEntryInput) => {
    query(
      'INSERT INTO journal_entries (game_id, positive_1, positive_2, improve_1, improve_2, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        gameId,
        normalizeJournalField(entry.positive1),
        normalizeJournalField(entry.positive2),
        normalizeJournalField(entry.improve1),
        normalizeJournalField(entry.improve2),
        new Date().toISOString(),
      ],
    ).catch((error) => {
      console.warn('Failed to record journal entry', error)
    })
  }, [])

  const listGames = useCallback(async (limit = 50): Promise<SavedGameSummary[]> => {
    try {
      const rows = await query(
        `SELECT g.id, g.played_at, g.pgn, g.result,
                EXISTS(SELECT 1 FROM journal_entries j WHERE j.game_id = g.id) AS has_journal
         FROM games g
         ORDER BY g.id DESC
         LIMIT ?`,
        [limit],
      )
      return rows.map(mapSavedGameRow)
    } catch (error) {
      console.warn('Failed to list reviewed games', error)
      return []
    }
  }, [])

  return { recordGame, recordJournalEntry, listGames }
}
