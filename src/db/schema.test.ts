import { describe, expect, it } from 'vitest'
import { SCHEMA_SQL, SCHEMA_TABLE_NAMES } from './schema'

describe('training feature schema', () => {
  it('declares every table it claims to', () => {
    for (const table of SCHEMA_TABLE_NAMES) {
      expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`)
    }
  })

  it('seeds a single streak_state row', () => {
    expect(SCHEMA_SQL).toContain('INSERT OR IGNORE INTO streak_state')
  })
})
