import type { SqliteRow, SqliteWorkerRequest, SqliteWorkerResponse } from './sqliteProtocol'

// wa-sqlite's OPFS VFS needs FileSystemSyncAccessHandle, which browsers only
// grant inside a dedicated worker — so the database itself lives in
// sqliteWorker.ts and this module is a thin request/response wrapper.
let worker: Worker | null = null
let nextRequestId = 1
const pending = new Map<number, { resolve: (rows: SqliteRow[]) => void; reject: (error: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker

  worker = new Worker(new URL('./sqliteWorker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (event: MessageEvent<SqliteWorkerResponse>) => {
    const { id, rows, error } = event.data
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)

    if (error) {
      entry.reject(new Error(error))
    } else {
      entry.resolve(rows)
    }
  })

  return worker
}

export function query(sql: string, params: unknown[] = []): Promise<SqliteRow[]> {
  const id = nextRequestId++
  const request: SqliteWorkerRequest = { id, sql, params }

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage(request)
  })
}
