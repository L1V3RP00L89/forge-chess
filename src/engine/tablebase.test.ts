import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  fetchTablebase,
  isTablebaseEligible,
  normalizeTablebaseFen,
  parseTablebaseResponse,
  tablebasePieceCount,
} from './tablebase'

describe('tablebase client', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('detects 7-piece tablebase eligibility from FEN piece placement', () => {
    expect(tablebasePieceCount('8/8/8/8/8/8/4K3/6k1 w - - 0 1')).toBe(2)
    expect(isTablebaseEligible('8/8/8/8/8/8/4K3/6k1 w - - 0 1')).toBe(true)
    expect(isTablebaseEligible('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe(false)
  })

  it('parses exact tablebase responses and filters malformed moves', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    const fen = '8/8/8/8/8/8/4K3/7k w - - 0 1'
    const parsed = parseTablebaseResponse(fen, {
      category: 'win',
      dtz: 1,
      precise_dtz: 1,
      dtm: 17,
      checkmate: false,
      stalemate: false,
      insufficient_material: false,
      moves: [
        { uci: 'e2f3', san: 'Kf3', category: 'loss', dtz: -2, dtm: -16, zeroing: false },
        { uci: 'bad', san: 'Bad', category: 'draw' },
      ],
    })

    expect(parsed).toEqual({
      fen,
      category: 'win',
      dtz: 1,
      preciseDtz: 1,
      dtc: undefined,
      dtm: 17,
      checkmate: false,
      stalemate: false,
      insufficientMaterial: false,
      moves: [
        {
          uci: 'e2f3',
          san: 'Kf3',
          category: 'loss',
          dtz: -2,
          preciseDtz: undefined,
          dtc: undefined,
          dtm: -16,
          zeroing: false,
          checkmate: false,
          stalemate: false,
        },
      ],
      fetchedAt: 1_700_000_000_000,
    })

    vi.useRealTimers()
  })

  it('fetches eligible FENs and skips ineligible starting positions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        category: 'draw',
        moves: [],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTablebase('8/8/8/8/8/8/4K3/6k1 w - - 0 1')).resolves.toMatchObject({
      category: 'draw',
    })
    await expect(fetchTablebase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).resolves.toBeNull()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(new URL(url).searchParams.get('fen')).toBe(normalizeTablebaseFen('8/8/8/8/8/8/4K3/6k1 w - - 0 1'))
  })

  it('does not cache a response aborted during parsing', async () => {
    let resolveJson: (payload: unknown) => void = () => {}
    let resolveJsonStarted: () => void = () => {}
    const jsonStarted = new Promise<void>(resolve => {
      resolveJsonStarted = resolve
    })
    const abortedPayload = {
      category: 'win',
      dtz: 1,
      moves: [],
    }
    const freshPayload = {
      category: 'draw',
      moves: [],
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => {
          resolveJsonStarted()
          return new Promise(resolve => {
            resolveJson = resolve
          })
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => freshPayload,
      })
    vi.stubGlobal('fetch', fetchMock)

    const fen = '8/8/8/8/8/8/4K3/5k2 w - - 0 1'
    const controller = new AbortController()
    const pending = fetchTablebase(fen, controller.signal)
    await jsonStarted

    controller.abort()
    resolveJson(abortedPayload)

    await expect(pending).rejects.toThrow()
    await expect(fetchTablebase(fen)).resolves.toMatchObject({ category: 'draw' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('hydrates valid tablebase responses from browser storage', async () => {
    const fen = '8/8/8/8/8/8/3K4/6k1 w - - 0 1'
    const payload = {
      fen: normalizeTablebaseFen(fen),
      category: 'win',
      dtz: 1,
      preciseDtz: 1,
      dtc: null,
      dtm: 12,
      checkmate: false,
      stalemate: false,
      insufficientMaterial: false,
      moves: [{
        uci: 'd2d1',
        san: 'Kd1',
        category: 'draw',
        dtz: 0,
        preciseDtz: 0,
        dtc: null,
        dtm: null,
        zeroing: false,
        checkmate: false,
        stalemate: false,
      }],
      fetchedAt: 1_700_000_000_000,
    }
    const localStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        [normalizeTablebaseFen(fen)]: {
          expiresAt: Date.now() + 60_000,
          payload,
        },
      })),
      setItem: vi.fn(),
    }
    const fetchMock = vi.fn()

    vi.stubGlobal('window', { localStorage: localStorageMock })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTablebase(fen)).resolves.toEqual(payload)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores malformed browser storage entries before fetching fresh tablebase data', async () => {
    const fen = '8/8/8/8/8/8/6K1/4k3 w - - 0 1'
    const localStorageMock = {
      getItem: vi.fn(() => JSON.stringify({
        [normalizeTablebaseFen(fen)]: {
          expiresAt: Date.now() + 60_000,
          payload: { fen, category: 'win', fetchedAt: Number.NaN, moves: [{ uci: 'bad', san: 'Bad', category: 'draw' }] },
        },
      })),
      setItem: vi.fn(),
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        category: 'draw',
        dtz: 0,
        moves: [{ uci: 'g2g3', san: 'Kg3', category: 'draw' }],
      }),
    })

    vi.stubGlobal('window', { localStorage: localStorageMock })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTablebase(fen)).resolves.toMatchObject({
      category: 'draw',
      moves: [{ uci: 'g2g3', san: 'Kg3', category: 'draw' }],
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reuses the parsed browser storage snapshot across repeated tablebase misses', async () => {
    const stored = {
      [normalizeTablebaseFen('8/8/8/8/8/8/4K3/6k1 w - - 0 1')]: {
        expiresAt: Date.now() + 60_000,
        payload: {
          fen: normalizeTablebaseFen('8/8/8/8/8/8/4K3/6k1 w - - 0 1'),
          category: 'draw',
          checkmate: false,
          stalemate: false,
          insufficientMaterial: false,
          moves: [],
          fetchedAt: 1_700_000_000_000,
        },
      },
    }
    let storageRaw = JSON.stringify(stored)
    const localStorageMock = {
      getItem: vi.fn(() => storageRaw),
      setItem: vi.fn((_: string, nextValue: string) => {
        storageRaw = nextValue
      }),
    }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        category: 'draw',
        moves: [],
      }),
    })
    const parseSpy = vi.spyOn(JSON, 'parse')

    vi.stubGlobal('window', { localStorage: localStorageMock })
    vi.stubGlobal('fetch', fetchMock)

    await fetchTablebase('8/8/8/8/8/8/5K2/6k1 w - - 0 1')
    await fetchTablebase('8/8/8/8/8/8/6K1/7k w - - 0 1')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(parseSpy).toHaveBeenCalledTimes(1)
  })
})
