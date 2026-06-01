import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess, type Move } from 'chess.js'
import { detectEngineCapabilities, resolveProfile } from '../engine/profiles'
import { createStockfishWorker } from '../engine/stockfishWorker'
import {
    fetchTablebase,
    isTablebaseEligible,
    tablebaseMoveCategoryForPlayer,
    type TablebaseCategory,
    type TablebaseResult,
} from '../engine/tablebase'

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

const BEGINNER_RANDOM_MOVE_CHANCE: Partial<Record<AiDifficulty, number>> = {
    1: 0.38,
    2: 0.20,
}
const EXACT_TABLEBASE_DIFFICULTY: AiDifficulty = 8
const TABLEBASE_AI_TIMEOUT_MS = 2500
const TABLEBASE_CATEGORY_PRIORITY: Record<TablebaseCategory, number> = {
    win: 8,
    'syzygy-win': 7,
    'maybe-win': 6,
    'cursed-win': 5,
    draw: 4,
    unknown: 3,
    'blessed-loss': 2,
    'maybe-loss': 1,
    'syzygy-loss': 0,
    loss: 0,
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

export function aiDifficultyCommands(difficulty: AiDifficulty): string[] {
    const skillLevel = Math.round(((difficulty - 1) / 7) * 20)

    if (difficulty === 8) {
        return [
            'setoption name UCI_LimitStrength value false',
            `setoption name Skill Level value ${skillLevel}`,
        ]
    }

    const elo = DIFFICULTY_ELO[difficulty]
    return [
        'setoption name UCI_LimitStrength value true',
        `setoption name UCI_Elo value ${elo}`,
        `setoption name Skill Level value ${skillLevel}`,
    ]
}

type AiStatus = 'loading' | 'ready' | 'thinking' | 'stopping' | 'error' | 'disabled'
const STOPPED_SEARCH_ACK_TIMEOUT_MS = 10_000

export function consumeStoppedSearchBestMove(pendingStoppedSearches: number): {
    ignore: boolean
    remaining: number
} {
    if (!Number.isFinite(pendingStoppedSearches) || pendingStoppedSearches <= 0) {
        return { ignore: false, remaining: 0 }
    }

    return { ignore: true, remaining: Math.max(0, Math.floor(pendingStoppedSearches) - 1) }
}

export function addStoppedSearchBestMoveAck(pendingStoppedSearches: number): number {
    if (!Number.isFinite(pendingStoppedSearches) || pendingStoppedSearches <= 0) return 1
    return Math.floor(pendingStoppedSearches) + 1
}

function moveToUci(move: Move): string {
    return `${move.from}${move.to}${move.promotion ?? ''}`
}

export function pickBeginnerVarietyMove(
    fen: string,
    difficulty: AiDifficulty,
    random = Math.random,
): string | null {
    const chance = BEGINNER_RANDOM_MOVE_CHANCE[difficulty]
    if (!chance) return null
    if (random() >= chance) return null

    try {
        const chess = new Chess(fen)
        const moves = chess.moves({ verbose: true })
        if (!moves.length) return null
        const index = Math.min(moves.length - 1, Math.floor(random() * moves.length))
        return moveToUci(moves[index]!)
    } catch {
        return null
    }
}

function tablebaseDistance(move: { dtm?: number | null; preciseDtz?: number | null; dtz?: number | null }): number | null {
    const value = move.dtm ?? move.preciseDtz ?? move.dtz
    return typeof value === 'number' && Number.isFinite(value) ? Math.abs(value) : null
}

function tablebaseTieBreak(category: TablebaseCategory, move: { dtm?: number | null; preciseDtz?: number | null; dtz?: number | null; zeroing?: boolean }): number {
    const distance = tablebaseDistance(move)
    if (distance === null) return move.zeroing ? 1 : 0
    if (TABLEBASE_CATEGORY_PRIORITY[category] >= TABLEBASE_CATEGORY_PRIORITY.draw) return -distance
    return distance
}

export function pickExactTablebaseMove(result: TablebaseResult | null): string | null {
    if (!result?.moves.length) return null

    const ranked = result.moves
        .map((move, index) => {
            const category = tablebaseMoveCategoryForPlayer(move.category)
            return {
                category,
                index,
                move,
                priority: TABLEBASE_CATEGORY_PRIORITY[category],
                tieBreak: tablebaseTieBreak(category, move),
            }
        })
        .sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority
            if (a.tieBreak !== b.tieBreak) return b.tieBreak - a.tieBreak
            return a.index - b.index
        })

    return ranked[0]?.move.uci ?? null
}

async function fetchExactTablebaseMove(fen: string, difficulty: AiDifficulty): Promise<string | null> {
    if (difficulty !== EXACT_TABLEBASE_DIFFICULTY) return null
    if (!isTablebaseEligible(fen)) return null

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TABLEBASE_AI_TIMEOUT_MS)
    try {
        return pickExactTablebaseMove(await fetchTablebase(fen, controller.signal))
    } catch {
        return null
    } finally {
        clearTimeout(timeout)
    }
}

export function useAiPlayer(enabled = true) {
    const workerRef = useRef<Worker | null>(null)
    const isReadyRef = useRef(false)
    const resolveRef = useRef<((move: string | null) => void) | null>(null)
    const requestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const stopAckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const ignoredBestMoveCountRef = useRef(0)
    const [status, setStatus] = useState<AiStatus>('loading')
    const [profileName, setProfileName] = useState('Stockfish')
    const difficultyRef = useRef<AiDifficulty>(4)

    const clearRequestTimeout = useCallback(() => {
        if (!requestTimeoutRef.current) return
        clearTimeout(requestTimeoutRef.current)
        requestTimeoutRef.current = null
    }, [])

    const clearStopAckTimeout = useCallback(() => {
        if (!stopAckTimeoutRef.current) return
        clearTimeout(stopAckTimeoutRef.current)
        stopAckTimeoutRef.current = null
    }, [])

    const releaseStoppedSearch = useCallback(() => {
        ignoredBestMoveCountRef.current = 0
        clearStopAckTimeout()
        if (enabled && workerRef.current && isReadyRef.current) {
            setStatus('ready')
        }
    }, [clearStopAckTimeout, enabled])

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
        for (const command of aiDifficultyCommands(difficulty)) {
            worker.postMessage(command)
        }
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
                    const stoppedSearchAck = consumeStoppedSearchBestMove(ignoredBestMoveCountRef.current)
                    if (stoppedSearchAck.ignore) {
                        ignoredBestMoveCountRef.current = stoppedSearchAck.remaining
                        if (ignoredBestMoveCountRef.current === 0) {
                            clearStopAckTimeout()
                        }
                        if (!resolveRef.current && workerRef.current && isReadyRef.current) {
                            setStatus('ready')
                        }
                        continue
                    }

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
            ignoredBestMoveCountRef.current = 0
            clearStopAckTimeout()
            settleRequest(null)
            if (workerBlobUrl) URL.revokeObjectURL(workerBlobUrl)
        }
    }, [applyDifficulty, clearStopAckTimeout, enabled, finishRequest, settleRequest])

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
            if (worker) {
                ignoredBestMoveCountRef.current = addStoppedSearchBestMoveAck(ignoredBestMoveCountRef.current)
                setStatus('stopping')
                clearStopAckTimeout()
                stopAckTimeoutRef.current = setTimeout(releaseStoppedSearch, STOPPED_SEARCH_ACK_TIMEOUT_MS)
            }
            try { worker?.postMessage('stop') } catch { /* worker may already be gone */ }
            settleRequest(null)
            return
        }
        if (enabled && worker && isReadyRef.current) setStatus('ready')
    }, [clearRequestTimeout, clearStopAckTimeout, enabled, releaseStoppedSearch, settleRequest])

    /** Request the engine to pick a move for the given position.
     *  Returns a promise resolving to a UCI move string (e.g. "e2e4") or null. */
    const requestMove = useCallback(
        (fen: string, difficulty: AiDifficulty): Promise<string | null> => {
            if (!enabled) return Promise.resolve(null)

            return (async () => {
                const exactMove = await fetchExactTablebaseMove(fen, difficulty)
                if (exactMove) return exactMove

                const worker = workerRef.current
                const varietyMove = pickBeginnerVarietyMove(fen, difficulty)
                if (varietyMove) return varietyMove
                if (!worker || !isReadyRef.current || resolveRef.current) return null
                if (ignoredBestMoveCountRef.current > 0) return null

                return new Promise((resolve) => {
                    if (difficultyRef.current !== difficulty) {
                        difficultyRef.current = difficulty
                        applyDifficulty(worker, difficulty)
                    }

                    resolveRef.current = resolve
                    setStatus('thinking')

                    const movetime = DIFFICULTY_MOVETIME[difficulty]
                    requestTimeoutRef.current = setTimeout(() => {
                        ignoredBestMoveCountRef.current = addStoppedSearchBestMoveAck(ignoredBestMoveCountRef.current)
                        setStatus('stopping')
                        clearStopAckTimeout()
                        stopAckTimeoutRef.current = setTimeout(releaseStoppedSearch, STOPPED_SEARCH_ACK_TIMEOUT_MS)
                        try { worker.postMessage('stop') } catch { /* worker may already be gone */ }
                        settleRequest(null)
                    }, movetime + 10_000)
                    worker.postMessage(`position fen ${fen}`)
                    // Per docs: "go movetime N" is the clean way to get a single best move
                    worker.postMessage(`go movetime ${movetime}`)
                })
            })()
        },
        [applyDifficulty, clearStopAckTimeout, enabled, releaseStoppedSearch, settleRequest],
    )

    return { status, requestMove, setDifficulty, cancelRequest, profileName }
}
