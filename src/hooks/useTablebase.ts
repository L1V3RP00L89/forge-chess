import { useEffect, useMemo, useState } from 'react'
import {
  fetchTablebase,
  getCachedTablebase,
  isTablebaseEligible,
  tablebasePieceCount,
  type TablebaseResult,
} from '../engine/tablebase'

export type TablebaseStatus = 'idle' | 'ineligible' | 'loading' | 'hit' | 'missing' | 'error'

type UseTablebaseArgs = {
  fen: string
  enabled: boolean
  debounceMs?: number
}

export function useTablebase({ fen, enabled, debounceMs = 280 }: UseTablebaseArgs) {
  const pieceCount = useMemo(() => tablebasePieceCount(fen), [fen])
  const eligible = enabled && isTablebaseEligible(fen)
  const cached = eligible ? getCachedTablebase(fen) : null
  const [resultByFen, setResultByFen] = useState<Record<string, TablebaseResult>>({})
  const [requestState, setRequestState] = useState<{
    error: string | null
    fen: string
    status: TablebaseStatus
  }>({ error: null, fen: '', status: 'idle' })

  const result = resultByFen[fen] ?? cached ?? null
  const status: TablebaseStatus = !enabled
    ? 'idle'
    : !eligible
      ? 'ineligible'
      : result
        ? 'hit'
        : requestState.fen === fen
          ? requestState.status
          : 'idle'
  const error = status === 'error' && requestState.fen === fen ? requestState.error : null

  useEffect(() => {
    if (!eligible || cached) return

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRequestState({ error: null, fen, status: 'loading' })

      fetchTablebase(fen, controller.signal)
        .then(nextResult => {
          if (controller.signal.aborted) return
          if (!nextResult) {
            setRequestState({ error: null, fen, status: 'missing' })
            return
          }

          setResultByFen(previous => ({ ...previous, [fen]: nextResult }))
          setRequestState({ error: null, fen, status: 'hit' })
        })
        .catch(nextError => {
          if (controller.signal.aborted) return
          setRequestState({
            error: nextError instanceof Error ? nextError.message : String(nextError),
            fen,
            status: 'error',
          })
        })
    }, debounceMs)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [cached, debounceMs, eligible, fen])

  return {
    eligible,
    error,
    pieceCount,
    result,
    status,
  }
}
