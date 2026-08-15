export type SqliteRow = Record<string, string | number | Uint8Array | null>

export type SqliteWorkerRequest = {
  id: number
  sql: string
  params?: unknown[]
}

export type SqliteWorkerResponse = {
  id: number
  rows: SqliteRow[]
  error: string | null
}
