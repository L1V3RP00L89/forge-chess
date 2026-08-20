import { useCallback } from 'react'
import { query } from '../db/sqliteClient'
import type { SqliteRow } from '../db/sqliteProtocol'
import { extractDrillUnits, type DrillStep, type RepertoireParseResult, type RepertoireSide } from '../engine/repertoire'
import { computeNextReview } from '../engine/spacedRepetition'

export type RepertoireSummary = {
    id: number
    side: RepertoireSide
    sourceFilename: string | null
    rootFen: string
    importedAt: string
    gameCount: number
    mergedGameCount: number
    drillUnitCount: number
}

export type StoredDrillUnit = {
    id: number
    unitKey: string
    setupUci: string[]
    steps: DrillStep[]
    sourceLabels: string[]
    nextReviewAt: string
    reviewCount: number
    solvedStreak: number
}

export function mapRepertoireRow(row: SqliteRow): RepertoireSummary {
    return {
        id: Number(row.id),
        side: row.side === 'b' ? 'b' : 'w',
        sourceFilename: row.source_filename == null ? null : String(row.source_filename),
        rootFen: String(row.root_fen),
        importedAt: String(row.imported_at),
        gameCount: Number(row.game_count),
        mergedGameCount: Number(row.merged_game_count),
        drillUnitCount: Number(row.drill_unit_count),
    }
}

export function mapDrillUnitRow(row: SqliteRow): StoredDrillUnit {
    return {
        id: Number(row.id),
        unitKey: String(row.unit_key),
        setupUci: JSON.parse(String(row.setup_uci)) as string[],
        steps: JSON.parse(String(row.steps)) as DrillStep[],
        sourceLabels: JSON.parse(String(row.source_labels)) as string[],
        nextReviewAt: String(row.next_review_at),
        reviewCount: Number(row.review_count),
        solvedStreak: Number(row.solved_streak),
    }
}

export function useRepertoireDb() {
    const getRepertoireSummary = useCallback(async (side: RepertoireSide): Promise<RepertoireSummary | null> => {
        try {
            const rows = await query('SELECT * FROM repertoires WHERE side = ?', [side])
            return rows[0] ? mapRepertoireRow(rows[0]) : null
        } catch (error) {
            console.warn('Failed to load repertoire summary', error)
            return null
        }
    }, [])

    const importRepertoire = useCallback(async (
        side: RepertoireSide,
        sourceFilename: string,
        parseResult: RepertoireParseResult,
    ): Promise<RepertoireSummary | null> => {
        const units = extractDrillUnits(parseResult.tree, side)
        try {
            const existing = await query('SELECT id FROM repertoires WHERE side = ?', [side])
            const existingId = existing[0]?.id
            if (existingId != null) {
                await query('DELETE FROM repertoire_units WHERE repertoire_id = ?', [existingId])
                await query('DELETE FROM repertoires WHERE id = ?', [existingId])
            }

            const importedAt = new Date().toISOString()
            await query(
                `INSERT INTO repertoires
                    (side, source_filename, root_fen, imported_at, game_count, merged_game_count, drill_unit_count)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [side, sourceFilename, parseResult.rootFen, importedAt, parseResult.gameCount, parseResult.mergedGameCount, units.length],
            )
            const idRows = await query('SELECT last_insert_rowid() AS id')
            const repertoireId = idRows[0]?.id
            if (typeof repertoireId !== 'number') return null

            for (const unit of units) {
                await query(
                    `INSERT INTO repertoire_units
                        (repertoire_id, unit_key, setup_uci, steps, source_labels, next_review_at, review_count, solved_streak)
                     VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
                    [
                        repertoireId,
                        unit.id,
                        JSON.stringify(unit.setupUci),
                        JSON.stringify(unit.steps),
                        JSON.stringify(unit.sourceLabels),
                        importedAt,
                    ],
                )
            }

            return {
                id: repertoireId,
                side,
                sourceFilename,
                rootFen: parseResult.rootFen,
                importedAt,
                gameCount: parseResult.gameCount,
                mergedGameCount: parseResult.mergedGameCount,
                drillUnitCount: units.length,
            }
        } catch (error) {
            console.warn('Failed to import repertoire', error)
            return null
        }
    }, [])

    const removeRepertoire = useCallback(async (side: RepertoireSide): Promise<void> => {
        try {
            const rows = await query('SELECT id FROM repertoires WHERE side = ?', [side])
            const id = rows[0]?.id
            if (id == null) return
            await query('DELETE FROM repertoire_units WHERE repertoire_id = ?', [id])
            await query('DELETE FROM repertoires WHERE id = ?', [id])
        } catch (error) {
            console.warn('Failed to remove repertoire', error)
        }
    }, [])

    const countDueUnits = useCallback(async (side: RepertoireSide): Promise<number> => {
        try {
            const rows = await query(
                `SELECT COUNT(*) AS n FROM repertoire_units ru
                 JOIN repertoires r ON r.id = ru.repertoire_id
                 WHERE r.side = ? AND ru.next_review_at <= ?`,
                [side, new Date().toISOString()],
            )
            return Number(rows[0]?.n ?? 0)
        } catch (error) {
            console.warn('Failed to count due repertoire units', error)
            return 0
        }
    }, [])

    const listDueUnits = useCallback(async (side: RepertoireSide, limit = 20): Promise<StoredDrillUnit[]> => {
        try {
            const rows = await query(
                `SELECT ru.* FROM repertoire_units ru
                 JOIN repertoires r ON r.id = ru.repertoire_id
                 WHERE r.side = ? AND ru.next_review_at <= ?
                 ORDER BY ru.next_review_at ASC
                 LIMIT ?`,
                [side, new Date().toISOString(), limit],
            )
            return rows.map(mapDrillUnitRow)
        } catch (error) {
            console.warn('Failed to list due repertoire units', error)
            return []
        }
    }, [])

    const recordDrillResult = useCallback(async (unitId: number, correct: boolean): Promise<void> => {
        try {
            const rows = await query('SELECT review_count, solved_streak FROM repertoire_units WHERE id = ?', [unitId])
            const row = rows[0]
            if (!row) return
            const next = computeNextReview(
                { reviewCount: Number(row.review_count), solvedStreak: Number(row.solved_streak) },
                correct,
            )
            await query(
                'UPDATE repertoire_units SET next_review_at = ?, review_count = ?, solved_streak = ? WHERE id = ?',
                [next.nextReviewAt, next.reviewCount, next.solvedStreak, unitId],
            )
        } catch (error) {
            console.warn('Failed to record drill result', error)
        }
    }, [])

    return {
        getRepertoireSummary,
        importRepertoire,
        removeRepertoire,
        countDueUnits,
        listDueUnits,
        recordDrillResult,
    }
}
