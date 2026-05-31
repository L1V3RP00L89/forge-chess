import { useEffect, useMemo, useState } from 'react'
import {
  cloudEvalRequestKey,
  fetchCloudEvaluation,
  getCachedCloudEvaluation,
  type CloudEvalResult,
} from '../engine/cloudEval'
import { withBoundedMapEntry } from './cacheLimit'

export type CloudEvalStatus = 'idle' | 'loading' | 'hit' | 'missing' | 'error'

type UseCloudEvaluationOptions = {
  fen: string
  multiPv: number
  enabled: boolean
}

const CLOUD_EVAL_DEBOUNCE_MS = 320
const LOCAL_CLOUD_EVAL_LIMIT = 120

export function useCloudEvaluation({ fen, multiPv, enabled }: UseCloudEvaluationOptions) {
  const normalizedMultiPv = Math.max(1, Math.min(5, multiPv))
  const currentKey = useMemo(
    () => cloudEvalRequestKey({ fen, multiPv: normalizedMultiPv }),
    [fen, normalizedMultiPv],
  )
  const [evaluations, setEvaluations] = useState<Map<string, CloudEvalResult>>(new Map())
  const [requestState, setRequestState] = useState<{
    error: string | null
    key: string
    status: CloudEvalStatus
  }>({ error: null, key: '', status: 'idle' })
  const cached = enabled ? getCachedCloudEvaluation({ fen, multiPv: normalizedMultiPv }) : null
  const result = evaluations.get(currentKey) ?? cached
  const status: CloudEvalStatus = !enabled
    ? 'idle'
    : result
      ? 'hit'
      : requestState.key === currentKey
        ? requestState.status
        : 'idle'
  const error = status === 'error' && requestState.key === currentKey ? requestState.error : null

  useEffect(() => {
    if (!enabled || cached) return

    const request = { fen, multiPv: normalizedMultiPv }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setRequestState({ error: null, key: currentKey, status: 'loading' })

      fetchCloudEvaluation(request, controller.signal)
        .then(nextResult => {
          if (controller.signal.aborted) return
          if (!nextResult) {
            setRequestState({ error: null, key: currentKey, status: 'missing' })
            return
          }

          setEvaluations(previous => {
            return withBoundedMapEntry(previous, currentKey, nextResult, LOCAL_CLOUD_EVAL_LIMIT)
          })
          setRequestState({ error: null, key: currentKey, status: 'hit' })
        })
        .catch(nextError => {
          if (controller.signal.aborted) return
          setRequestState({
            error: nextError instanceof Error ? nextError.message : String(nextError),
            key: currentKey,
            status: 'error',
          })
        })
    }, CLOUD_EVAL_DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [cached, currentKey, enabled, fen, normalizedMultiPv])

  return {
    error,
    multiPv: normalizedMultiPv,
    result,
    status,
  }
}
