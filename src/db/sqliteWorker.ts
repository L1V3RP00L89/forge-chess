/// <reference lib="webworker" />
import SQLiteESMFactory from '@journeyapps/wa-sqlite/dist/wa-sqlite.mjs'
import * as SQLite from '@journeyapps/wa-sqlite'
// @ts-expect-error -- no published types for the OPFS VFS example
import { OPFSCoopSyncVFS } from '@journeyapps/wa-sqlite/src/examples/OPFSCoopSyncVFS.js'
import { SCHEMA_SQL } from './schema'
import type { SqliteWorkerRequest, SqliteWorkerResponse, SqliteRow } from './sqliteProtocol'

const DB_FILENAME = 'forge-chess.sqlite3'

let state: { sqlite3: SQLiteAPI; db: number } | null = null

async function ensureDatabase(): Promise<{ sqlite3: SQLiteAPI; db: number }> {
  if (state) return state

  const module = await SQLiteESMFactory()
  const sqlite3: SQLiteAPI = SQLite.Factory(module)
  const vfs = await OPFSCoopSyncVFS.create('forge-chess-opfs', module)
  sqlite3.vfs_register(vfs, true)

  const db = await sqlite3.open_v2(DB_FILENAME)
  await sqlite3.exec(db, SCHEMA_SQL)

  state = { sqlite3, db }
  return state
}

async function run(sql: string, params: unknown[]): Promise<SqliteRow[]> {
  const { sqlite3: api, db: handle } = await ensureDatabase()
  const rows: SqliteRow[] = []

  for await (const stmt of api.statements(handle, sql)) {
    if (params.length) {
      api.bind_collection(stmt, params as SQLiteCompatibleType[])
    }
    while ((await api.step(stmt)) === SQLite.SQLITE_ROW) {
      const columns = api.column_names(stmt)
      const values = api.row(stmt)
      const row: SqliteRow = {}
      columns.forEach((name: string, index: number) => {
        row[name] = values[index] as SqliteRow[string]
      })
      rows.push(row)
    }
  }

  return rows
}

// wa-sqlite's OPFS VFS holds a single connection with no internal locking of
// its own, so overlapping requests (e.g. a list refresh firing while a game
// is still being inserted) raced against each other and surfaced as
// "database is locked". Requests are chained onto one queue so the worker
// only ever runs one statement at a time, in the order messages arrived.
let queue: Promise<void> = Promise.resolve()

self.addEventListener('message', (event: MessageEvent<SqliteWorkerRequest>) => {
  const { id, sql, params } = event.data

  queue = queue.then(async () => {
    const response: SqliteWorkerResponse = { id, rows: [], error: null }

    try {
      response.rows = await run(sql, params ?? [])
    } catch (error) {
      response.error = error instanceof Error ? error.message : String(error)
    }

    self.postMessage(response)
  })
})
