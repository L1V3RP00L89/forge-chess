import type { EvalSnapshot } from './analysis'

export type CloudEvalRequest = {
  fen: string
  multiPv?: number
}

export type CloudEvalLine = {
  moves: string[]
  cp?: number
  mate?: number
}

export type CloudEvalResult = {
  fen: string
  depth: number
  knodes: number
  pvs: CloudEvalLine[]
  fetchedAt: number
}

const CLOUD_EVAL_URL = 'https://lichess.org/api/cloud-eval'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_STORAGE_KEY = 'webchess:cloud-eval-cache:v1'
const CACHE_STORAGE_LIMIT = 120
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i

type CacheEntry = {
  expiresAt: number
  payload: CloudEvalResult
}

const responseCache = new Map<string, CacheEntry>()

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function positiveInt(value: unknown, fallback = 0): number {
  if (!isFiniteNumber(value)) return fallback
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : fallback
}

function normalizeMultiPv(value: number | undefined): number {
  if (!isFiniteNumber(value)) return 1
  return Math.max(1, Math.min(5, Math.round(value)))
}

export function normalizeCloudEvalFen(fen: string): string {
  const parts = fen.trim().split(/\s+/g)
  return parts.length >= 4 ? parts.slice(0, 4).join(' ') : fen.trim()
}

export function cloudEvalRequestKey(request: CloudEvalRequest): string {
  return `${normalizeCloudEvalFen(request.fen)}|${normalizeMultiPv(request.multiPv)}`
}

function readStorageCache(): Record<string, CacheEntry> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, CacheEntry>
      : {}
  } catch {
    return {}
  }
}

function writeStorageCache(cache: Record<string, CacheEntry>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Cache persistence is optional; ignore private-mode/quota failures.
  }
}

function writeStorageCacheEntry(key: string, entry: CacheEntry) {
  const now = Date.now()
  const stored = readStorageCache()
  stored[key] = entry

  const pruned = Object.fromEntries(
    Object.entries(stored)
      .filter(([, value]) => value.expiresAt > now)
      .sort(([, a], [, b]) => b.expiresAt - a.expiresAt)
      .slice(0, CACHE_STORAGE_LIMIT),
  )
  writeStorageCache(pruned)
}

function readCached(request: CloudEvalRequest): CloudEvalResult | null {
  const key = cloudEvalRequestKey(request)
  const cached = responseCache.get(key)
  const now = Date.now()
  if (cached) {
    if (cached.expiresAt > now) return cached.payload
    responseCache.delete(key)
  }

  const stored = readStorageCache()[key]
  if (!stored) return null
  if (stored.expiresAt <= now) return null

  responseCache.set(key, stored)
  return stored.payload
}

function writeCached(request: CloudEvalRequest, payload: CloudEvalResult) {
  const key = cloudEvalRequestKey(request)
  const entry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  }
  responseCache.set(key, entry)
  writeStorageCacheEntry(key, entry)
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (!signal?.aborted) return
  const reason = signal.reason
  throw reason instanceof Error ? reason : new Error('Lichess cloud eval request aborted.')
}

function buildUrl(request: CloudEvalRequest): string {
  const url = new URL(CLOUD_EVAL_URL)
  url.searchParams.set('fen', normalizeCloudEvalFen(request.fen))
  url.searchParams.set('multiPv', String(normalizeMultiPv(request.multiPv)))
  return url.toString()
}

function parseLine(raw: unknown): CloudEvalLine | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.moves !== 'string') return null

  const moves = row.moves
    .trim()
    .split(/\s+/g)
    .filter(move => UCI_MOVE_REGEX.test(move))

  if (!moves.length) return null

  if (isFiniteNumber(row.cp)) return { moves, cp: Math.round(row.cp) }
  if (isFiniteNumber(row.mate)) return { moves, mate: Math.round(row.mate) }
  return null
}

export function parseCloudEvalResponse(raw: unknown): CloudEvalResult | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as Record<string, unknown>
  if (typeof payload.fen !== 'string') return null

  const pvs = Array.isArray(payload.pvs)
    ? payload.pvs.map(parseLine).filter((line): line is CloudEvalLine => Boolean(line))
    : []

  if (!pvs.length) return null

  return {
    fen: normalizeCloudEvalFen(payload.fen),
    depth: positiveInt(payload.depth),
    knodes: positiveInt(payload.knodes),
    pvs,
    fetchedAt: Date.now(),
  }
}

export function getCachedCloudEvaluation(request: CloudEvalRequest): CloudEvalResult | null {
  return readCached(request)
}

export async function fetchCloudEvaluation(
  request: CloudEvalRequest,
  signal?: AbortSignal,
): Promise<CloudEvalResult | null> {
  const cached = readCached(request)
  if (cached) return cached

  const response = await fetch(buildUrl(request), {
    signal,
    headers: { Accept: 'application/json' },
  })
  throwIfAborted(signal)

  if (response.status === 404) return null
  if (response.status === 429) {
    throw new Error('Lichess cloud eval rate limit reached; try again in a minute.')
  }
  if (!response.ok) {
    throw new Error(`Lichess cloud eval request failed (${response.status}).`)
  }

  const raw = await response.json()
  throwIfAborted(signal)

  const parsed = parseCloudEvalResponse(raw)
  if (parsed) writeCached(request, parsed)
  return parsed
}

export function cloudLineToSideToMoveScore(
  fen: string,
  line: CloudEvalLine,
): { cp?: number; mate?: number } {
  const turn = fen.split(/\s+/g)[1]
  const factor = turn === 'b' ? -1 : 1
  return {
    cp: typeof line.cp === 'number' ? line.cp * factor : undefined,
    mate: typeof line.mate === 'number' ? line.mate * factor : undefined,
  }
}

function scoreToRequiredCp(cp?: number, mate?: number): number | null {
  if (typeof mate === 'number') {
    if (mate > 0) return 10000
    if (mate < 0) return -10000
    return null
  }
  return typeof cp === 'number' ? cp : null
}

export function cloudEvalToSnapshot(fen: string, result: CloudEvalResult): EvalSnapshot | null {
  const topLine = result.pvs[0]
  if (!topLine) return null
  const score = cloudLineToSideToMoveScore(fen, topLine)
  const cp = scoreToRequiredCp(score.cp, score.mate)
  if (cp === null) return null

  return {
    cp,
    mate: score.mate,
    depth: result.depth,
    nodes: result.knodes * 1000,
    mode: 'custom',
    purpose: 'cloud-eval',
    searchedAt: result.fetchedAt,
  }
}
