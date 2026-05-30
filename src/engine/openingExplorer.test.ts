import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOpeningExplorer, prefetchOpeningExplorer } from './openingExplorer'

describe('opening explorer client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fails fast without a Lichess API token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchOpeningExplorer({ source: 'masters', moves: [] })).rejects.toThrow(
      'Opening Explorer requires a Lichess API token.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends bearer auth, normalizes filters, and caches responses by position', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        white: 10,
        draws: 5,
        black: 3,
        moves: [{ uci: 'e7e5', san: 'e5', white: 4, draws: 2, black: 1 }],
        topGames: [],
        recentGames: [],
        opening: { eco: 'C20', name: 'King Pawn Game' },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const request = {
      source: 'lichess' as const,
      moves: [' e2e4 '],
      speeds: ['rapid' as const, 'blitz' as const],
      ratings: [1600, 5000],
      authToken: 'Bearer test-token',
    }

    const first = await fetchOpeningExplorer(request)
    const second = await fetchOpeningExplorer({ ...request, authToken: 'Bearer other-token' })

    expect(first.white).toBe(10)
    expect(second).toBe(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, options] = fetchMock.mock.calls[0] as [string, { headers: HeadersInit }]
    expect(url).toContain('/lichess?')
    expect(url).toContain('play=e2e4')
    expect(url).toContain('speeds=rapid%2Cblitz')
    expect(url).toContain('ratings=1600')
    expect(url).not.toContain('5000')
    expect(options.headers).toEqual({ Authorization: 'Bearer test-token' })
  })

  it('does not prefetch when the token is missing', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await prefetchOpeningExplorer({ source: 'masters', moves: ['d2d4'] })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
