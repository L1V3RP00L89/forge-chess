import { useCallback, useEffect, useRef, useState } from 'react'
import { detectEngineCapabilities, resolveProfile } from '../engine/profiles'
import { createStockfishWorker } from '../engine/stockfishWorker'

export type AiDifficulty = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

// Per Stockfish.js docs: UCI_LimitStrength + UCI_Elo (range 1320-3190)
// Skill Level alone is coarser (0-20) so we use Elo for a richer difficulty curve.
const DIFFICULTY_ELO: Record<AiDifficulty, number> = {
    1: 1320,
    2: 1500,
    3: 1700,
    4: 1900,
    5: 2100,
    6: 2300,
    7: 2600,
    8: 3190,
}

// movetime in ms per difficulty — give easier levels more think time
// so they can choose from more moves (and still not feel instant)
const DIFFICULTY_MOVETIME: Record<AiDifficulty, number> = {
    1: 200,
    2: 300,
    3: 400,
    4: 500,
    5: 700,
    6: 1000,
    7: 1500,
    8: 2000,
}

export const DIFFICULTY_LABELS: Record<AiDifficulty, string> = {
    1: 'Beginner',
    2: 'Novice',
    3: 'Club',
    4: 'Intermediate',
    5: 'Advanced',
    6: 'Expert',
    7: 'Master',
    8: 'Maximum',
}

type AiStatus = 'loading' | 'ready' | 'thinking' | 'error' | 'disabled'

export function useAiPlayer(enabled = true) {
    const workerRef = useRef<Worker | null>(null)
    const isReadyRef = useRef(false)
    const resolveRef = useRef<((move: string | null) => void) | null>(null)
    const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [status, setStatus] = useState<AiStatus>('loading')
    const [profileName, setProfileName] = useState('Stockfish')
    const difficultyRef = useRef<AiDifficulty>(4)

    const clearRequestTimeout = useCallback(() => {
        if (!requestTimeoutRef.current) return
        clearTimeout(requestTimeoutRef.current)
        requestTimeoutRef.current = null
    }, [])

    const settleRequest = useCallback((move: string | null) => {
        clearRequestTimeout()
        const resolve = resolveRef.current
        resolveRef.current = null
        resolve?.(move)
    }, [clearRequestTimeout])

    const finishRequest = useCallback((move: string | null, nextStatus: AiStatus) => {
        settleRequest(move)
        setStatus(nextStatus)
    }, [settleRequest])

    const applyDifficulty = useCallback((worker: Worker, difficulty: AiDifficulty) => {
        const elo = DIFFICULTY_ELO[difficulty]
        // Per Stockfish.js docs (stockfishjs-research-2026-02-22.md):
        // UCI_LimitStrength (check) + UCI_Elo (spin, 1320-3190)
        worker.postMessage('setoption name UCI_LimitStrength value true')
        worker.postMessage(`setoption name UCI_Elo value ${elo}`)
        // Also set Skill Level for redundancy on lite builds that may use it
        const skillLevel = Math.round(((difficulty - 1) / 7) * 20)
        worker.postMessage(`setoption name Skill Level value ${skillLevel}`)
    }, [])

    // Boot a fresh Stockfish worker for the AI player.
    useEffect(() => {
        let active = true
        let worker: Worker | null = null
        let workerBlobUrl: string | undefined

        if (!enabled) {
            workerRef.current = null
            isReadyRef.current = false
            settleRequest(null)
            queueMicrotask(() => {
                if (active) setStatus('disabled')
            })
            return () => {
                active = false
            }
        }

        const profile = resolveProfile('auto', detectEngineCapabilities())

        try {
            const created = createStockfishWorker(profile)
            worker = created.worker
            workerBlobUrl = created.blobUrl
        } catch {
            queueMicrotask(() => {
                if (active) setStatus('error')
            })
            return () => {
                active = false
                if (workerBlobUrl) URL.revokeObjectURL(workerBlobUrl)
            }
        }

        workerRef.current = worker
        isReadyRef.current = false
        queueMicrotask(() => {
            if (active) setProfileName(profile.name)
        })

        worker.onmessage = (event: MessageEvent<unknown>) => {
            if (!active) return
            if (typeof event.data !== 'string') return
            const lines = event.data.split(/\r?\n/g).map(line => line.trim()).filter(Boolean)

            for (const line of lines) {
                if (line.startsWith('__BOOT_ERROR__:')) {
                    isReadyRef.current = false
                    finishRequest(null, 'error')
                    worker?.terminate()
                    workerRef.current = null
                    return
                }

                if (line === 'uciok') {
                    worker?.postMessage('isready')
                }

                if (line === 'readyok' && worker) {
                    isReadyRef.current = true
                    applyDifficulty(worker, difficultyRef.current)
                    setStatus('ready')
                }

                if (line.startsWith('bestmove ')) {
                    const parts = line.split(' ')
                    const move = parts[1] ?? null
                    finishRequest(move === '(none)' ? null : move, 'ready')
                }
            }
        }

        worker.onerror = () => {
            if (!active) return
            isReadyRef.current = false
            finishRequest(null, 'error')
        }

        worker.postMessage('uci')

        return () => {
            active = false
            try { worker?.postMessage('quit') } catch { /* already gone */ }
            worker?.terminate()
            workerRef.current = null
            isReadyRef.current = false
            settleRequest(null)
            if (workerBlobUrl) URL.revokeObjectURL(workerBlobUrl)
        }
    }, [applyDifficulty, enabled, finishRequest, settleRequest])

    const setDifficulty = useCallback((difficulty: AiDifficulty) => {
        difficultyRef.current = difficulty
        if (workerRef.current && isReadyRef.current) {
            applyDifficulty(workerRef.current, difficulty)
        }
    }, [applyDifficulty])

    const cancelRequest = useCallback(() => {
        const worker = workerRef.current
        clearRequestTimeout()
        if (resolveRef.current) {
            try { worker?.postMessage('stop') } catch { /* worker may already be gone */ }
            settleRequest(null)
        }
        if (enabled && worker && isReadyRef.current) setStatus('ready')
    }, [clearRequestTimeout, enabled, settleRequest])

    /** Request the engine to pick a move for the given position.
     *  Returns a promise resolving to a UCI move string (e.g. "e2e4") or null. */
    const requestMove = useCallback(
        (fen: string, difficulty: AiDifficulty): Promise<string | null> => {
            const worker = workerRef.current
            if (!enabled) return Promise.resolve(null)
            if (!worker || !isReadyRef.current || resolveRef.current) return Promise.resolve(null)

            return new Promise((resolve) => {
                if (difficultyRef.current !== difficulty) {
                    difficultyRef.current = difficulty
                    applyDifficulty(worker, difficulty)
                }

                resolveRef.current = resolve
                setStatus('thinking')

                const movetime = DIFFICULTY_MOVETIME[difficulty]
                requestTimeoutRef.current = setTimeout(() => {
                    try { worker.postMessage('stop') } catch { /* worker may already be gone */ }
                    finishRequest(null, 'ready')
                }, movetime + 10_000)
                worker.postMessage(`position fen ${fen}`)
                // Per docs: "go movetime N" is the clean way to get a single best move
                worker.postMessage(`go movetime ${movetime}`)
            })
        },
        [applyDifficulty, enabled, finishRequest],
    )

    return { status, requestMove, setDifficulty, cancelRequest, profileName }
}
