import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLichessResource, resetLichessFetchQueueForTests } from './lichessQueue'

function deferredResponse() {
  let resolve: (response: Response) => void = () => {}
  const promise = new Promise<Response>(nextResolve => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('Lichess request queue', () => {
  afterEach(() => {
    resetLichessFetchQueueForTests()
    vi.unstubAllGlobals()
  })

  it('serializes remote requests so only one Lichess fetch starts at a time', async () => {
    const first = deferredResponse()
    const second = deferredResponse()
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    vi.stubGlobal('fetch', fetchMock)

    const firstRequest = fetchLichessResource('https://lichess.org/one')
    const secondRequest = fetchLichessResource('https://lichess.org/two')

    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    first.resolve(new Response('one'))
    await expect(firstRequest).resolves.toBeInstanceOf(Response)
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    second.resolve(new Response('two'))
    await expect(secondRequest).resolves.toBeInstanceOf(Response)
  })

  it('skips queued requests that are aborted before they start', async () => {
    const first = deferredResponse()
    const fetchMock = vi.fn().mockReturnValueOnce(first.promise)
    vi.stubGlobal('fetch', fetchMock)

    const firstRequest = fetchLichessResource('https://lichess.org/one')
    const controller = new AbortController()
    const secondRequest = fetchLichessResource('https://lichess.org/two', {
      signal: controller.signal,
    })

    controller.abort(new Error('cancelled'))
    first.resolve(new Response('one'))

    await expect(firstRequest).resolves.toBeInstanceOf(Response)
    await expect(secondRequest).rejects.toThrow('cancelled')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
