import { useCallback } from 'react'
import { query } from '../db/sqliteClient'

// scope_key is either a calendar date (Base Work, resets daily) or "week-N"
// (Extra Credit, resets weekly) -- see schema.ts. A row's mere existence
// means "checked"; there's no stored false.
export function useChecklistDb() {
    const getChecked = useCallback(async (scopeKey: string): Promise<Set<string>> => {
        try {
            const rows = await query('SELECT item_key FROM checklist_checks WHERE scope_key = ?', [scopeKey])
            return new Set(rows.map(row => String(row.item_key)))
        } catch (error) {
            console.warn('Failed to load checklist state', error)
            return new Set()
        }
    }, [])

    const setChecked = useCallback(async (scopeKey: string, itemKey: string, checked: boolean): Promise<void> => {
        try {
            if (checked) {
                await query('INSERT OR IGNORE INTO checklist_checks (scope_key, item_key) VALUES (?, ?)', [scopeKey, itemKey])
            } else {
                await query('DELETE FROM checklist_checks WHERE scope_key = ? AND item_key = ?', [scopeKey, itemKey])
            }
        } catch (error) {
            console.warn('Failed to update checklist state', error)
        }
    }, [])

    return { getChecked, setChecked }
}
