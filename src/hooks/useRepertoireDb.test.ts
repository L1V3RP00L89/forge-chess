import { describe, expect, it } from 'vitest'
import { mapDrillUnitRow, mapRepertoireRow } from './useRepertoireDb'

describe('mapRepertoireRow', () => {
    it('maps a repertoire row', () => {
        expect(mapRepertoireRow({
            id: 1,
            side: 'w',
            source_filename: 'London-System-Variations.pgn',
            root_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            imported_at: '2026-08-20T12:00:00.000Z',
            game_count: 292,
            merged_game_count: 292,
            drill_unit_count: 376,
        })).toEqual({
            id: 1,
            side: 'w',
            sourceFilename: 'London-System-Variations.pgn',
            rootFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            importedAt: '2026-08-20T12:00:00.000Z',
            gameCount: 292,
            mergedGameCount: 292,
            drillUnitCount: 376,
        })
    })

    it('maps a null source filename and defaults an unrecognized side to white', () => {
        const mapped = mapRepertoireRow({
            id: 2,
            side: 'x',
            source_filename: null,
            root_fen: 'startpos',
            imported_at: '2026-08-20T12:00:00.000Z',
            game_count: 0,
            merged_game_count: 0,
            drill_unit_count: 0,
        })
        expect(mapped.sourceFilename).toBeNull()
        expect(mapped.side).toBe('w')
    })
})

describe('mapDrillUnitRow', () => {
    it('parses the JSON columns back into arrays', () => {
        const mapped = mapDrillUnitRow({
            id: 5,
            unit_key: 'd2d4',
            setup_uci: '[]',
            steps: JSON.stringify([{ ownerUci: 'd2d4', ownerSan: 'd4' }]),
            source_labels: JSON.stringify(['A45']),
            next_review_at: '2026-08-20T12:00:00.000Z',
            review_count: 3,
            solved_streak: 2,
        })
        expect(mapped).toEqual({
            id: 5,
            unitKey: 'd2d4',
            setupUci: [],
            steps: [{ ownerUci: 'd2d4', ownerSan: 'd4' }],
            sourceLabels: ['A45'],
            nextReviewAt: '2026-08-20T12:00:00.000Z',
            reviewCount: 3,
            solvedStreak: 2,
        })
    })
})
