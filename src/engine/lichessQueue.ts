let lichessFetchQueue: Promise<void> = Promise.resolve()

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason
  return reason instanceof Error ? reason : new Error('Lichess request aborted.')
}

export function resetLichessFetchQueueForTests() {
  lichessFetchQueue = Promise.resolve()
}

export function fetchLichessResource(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const signal = init.signal
  const run = async () => {
    if (signal?.aborted) throw abortError(signal)
    return fetch(input, init)
  }

  const request = lichessFetchQueue.then(run, run)
  lichessFetchQueue = request.then(
    () => undefined,
    () => undefined,
  )
  return request
}
