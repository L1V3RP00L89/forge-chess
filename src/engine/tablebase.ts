export type TablebaseCategory =
  | 'win'
  | 'unknown'
  | 'syzygy-win'
  | 'maybe-win'
  | 'cursed-win'
  | 'draw'
  | 'blessed-loss'
  | 'maybe-loss'
  | 'syzygy-loss'
  | 'loss'

export type TablebaseMove = {
  uci: string
  san: string
  category: TablebaseCategory
  dtz?: number | null
  preciseDtz?: number | null
  dtc?: number | null
  dtm?: number | null
  zeroing?: boolean
  checkmate?: boolean
  stalemate?: boolean
}

export type TablebaseResult = {
  fen: string
  category: TablebaseCategory
  dtz?: number | null
  preciseDtz?: number | null
  dtc?: number | null
  dtm?: number | null
  checkmate: boolean
  stalemate: boolean
  insufficientMaterial: boolean
  moves: TablebaseMove[]
  fetchedAt: number
}

const TABLEBASE_URL = 'https://tablebase.lichess.org/standard'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000
const CACHE_STORAGE_KEY = 'webchess:tablebase-cache:v1'
const CACHE_STORAGE_LIMIT = 80
const CATEGORY_VALUES = new Set<TablebaseCategory>([
  'win',
  'unknown',
  'syzygy-win',
  'maybe-win',
  'cursed-win',
  'draw',
  'blessed-loss',
  'maybe-loss',
  'syzygy-loss',
  'loss',
])
const UCI_MOVE_REGEX = /^[a-h][1-8][a-h][1-8][qrbn]?$/i

type CacheEntry = {
  expiresAt: number
  payload: TablebaseResult
}

const responseCache = new Map<string, CacheEntry>()

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function nullableInt(value: unknown): number | null | undefined {
  if (value === null) return null
  if (!isFiniteNumber(value)) return undefined
  return Math.round(value)
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function categoryValue(value: unknown): TablebaseCategory | null {
  return typeof value === 'string' && CATEGORY_VALUES.has(value as TablebaseCategory)
    ? value as TablebaseCategory
    : null
}

export function normalizeTablebaseFen(fen: string): string {
  return fen.trim().replace(/\s+/g, ' ')
}

export function tablebasePieceCount(fen: string): number {
  const board = normalizeTablebaseFen(fen).split(' ')[0] ?? ''
  return [...board].filter(char => /[prnbqk]/i.test(char)).length
}

export function isTablebaseEligible(fen: string): boolean {
  const count = tablebasePieceCount(fen)
  return count > 0 && count <= 7
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
    // Tablebase caching is optional; ignore private-mode/quota failures.
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

function readCached(fen: string): TablebaseResult | null {
  const key = normalizeTablebaseFen(fen)
  const now = Date.now()
  const cached = responseCache.get(key)
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

function writeCached(fen: string, payload: TablebaseResult) {
  const key = normalizeTablebaseFen(fen)
  const entry = {
    expiresAt: Date.now() + CACHE_TTL_MS,
    payload,
  }
  responseCache.set(key, entry)
  writeStorageCacheEntry(key, entry)
}

function parseMove(raw: unknown): TablebaseMove | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  if (typeof row.uci !== 'string' || !UCI_MOVE_REGEX.test(row.uci)) return null
  if (typeof row.san !== 'string') return null
  const category = categoryValue(row.category)
  if (!category) return null

  return {
    uci: row.uci,
    san: row.san,
    category,
    dtz: nullableInt(row.dtz),
    preciseDtz: nullableInt(row.precise_dtz),
    dtc: nullableInt(row.dtc),
    dtm: nullableInt(row.dtm),
    zeroing: booleanValue(row.zeroing),
    checkmate: booleanValue(row.checkmate),
    stalemate: booleanValue(row.stalemate),
  }
}

export function parseTablebaseResponse(fen: string, raw: unknown): TablebaseResult | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as Record<string, unknown>
  const category = categoryValue(payload.category)
  if (!category) return null

  return {
    fen: normalizeTablebaseFen(fen),
    category,
    dtz: nullableInt(payload.dtz),
    preciseDtz: nullableInt(payload.precise_dtz),
    dtc: nullableInt(payload.dtc),
    dtm: nullableInt(payload.dtm),
    checkmate: booleanValue(payload.checkmate),
    stalemate: booleanValue(payload.stalemate),
    insufficientMaterial: booleanValue(payload.insufficient_material),
    moves: Array.isArray(payload.moves)
      ? payload.moves.map(parseMove).filter((move): move is TablebaseMove => Boolean(move))
      : [],
    fetchedAt: Date.now(),
  }
}

function buildUrl(fen: string): string {
  const url = new URL(TABLEBASE_URL)
  url.searchParams.set('fen', normalizeTablebaseFen(fen))
  return url.toString()
}

export function getCachedTablebase(fen: string): TablebaseResult | null {
  return readCached(fen)
}

export async function fetchTablebase(fen: string, signal?: AbortSignal): Promise<TablebaseResult | null> {
  if (!isTablebaseEligible(fen)) return null

  const cached = readCached(fen)
  if (cached) return cached

  const response = await fetch(buildUrl(fen), {
    signal,
    headers: { Accept: 'application/json' },
  })

  if (response.status === 404) return null
  if (response.status === 429) {
    throw new Error('Lichess tablebase rate limit reached; try again in a minute.')
  }
  if (!response.ok) {
    throw new Error(`Lichess tablebase request failed (${response.status}).`)
  }

  const parsed = parseTablebaseResponse(fen, await response.json())
  if (parsed) writeCached(fen, parsed)
  return parsed
}
