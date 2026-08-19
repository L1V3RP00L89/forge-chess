import { describe, expect, it } from 'vitest'
import { extractDrillUnits, mergeRepertoireGames, parseRepertoirePgn, splitPgnGames } from './repertoire'
import { parsePgnMoveTree } from './pgn'

const HEADER = (over: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
        Event: '?',
        Site: '?',
        Date: '????.??.??',
        Round: '?',
        White: '?',
        Black: '?',
        Result: '*',
        ...over,
    }
    return Object.entries(headers)
        .map(([key, value]) => `[${key} "${value}"]`)
        .join('\n')
}

function game(movetext: string, headerOverrides: Record<string, string> = {}): string {
    return `${HEADER(headerOverrides)}\n\n${movetext}\n`
}

describe('splitPgnGames', () => {
    it('splits a multi-game PGN into individual game texts', () => {
        const text = game('1. d4 Nf6 *') + '\n' + game('1. e4 c6 *')
        const chunks = splitPgnGames(text)
        expect(chunks).toHaveLength(2)
        expect(chunks[0]).toContain('1. d4 Nf6')
        expect(chunks[1]).toContain('1. e4 c6')
    })

    it('returns a single chunk for a single game', () => {
        const text = game('1. d4 Nf6 *')
        expect(splitPgnGames(text)).toHaveLength(1)
    })

    it('returns an empty array for blank input', () => {
        expect(splitPgnGames('   ')).toEqual([])
    })
})

describe('parseRepertoirePgn', () => {
    it('merges games sharing a trunk into one tree', () => {
        const text = [
            game('1. d4 Nf6 2. Bf4 d5 3. e3 *'),
            game('1. d4 Nf6 2. Bf4 d5 3. e3 c5 4. c3 *'),
        ].join('\n')
        const result = parseRepertoirePgn(text)
        expect(result.gameCount).toBe(2)
        expect(result.mergedGameCount).toBe(2)
        expect(result.parseErrors).toEqual([])

        // d4 -> Nf6 -> Bf4 -> d5 -> e3 should be a single shared chain, not two branches
        let node = result.tree
        for (const uci of ['d2d4', 'g8f6', 'c1f4', 'd7d5', 'e2e3']) {
            expect(node.children).toHaveLength(1)
            node = node.children[0]!
            expect(node.uci).toBe(uci)
        }
        // only the second game extends past e3
        expect(node.children).toHaveLength(1)
        expect(node.children[0]!.san).toBe('c5')
    })

    it('excludes a "Course Outline" overview game from the merged tree', () => {
        const text = [
            game('1. e4 c6 2. d4 d5 *', { White: 'Course Outline', Black: '?' }),
            game('1. e4 c6 2. d4 d5 3. e5 c5 *', { White: 'Chapter 1', Black: 'Advanced' }),
        ].join('\n')
        const result = parseRepertoirePgn(text)
        expect(result.gameCount).toBe(2)
        expect(result.mergedGameCount).toBe(1)
        // the surviving chapter's line should still be present
        let node = result.tree
        for (const san of ['e4', 'c6', 'd4', 'd5', 'e5', 'c5']) {
            node = node.children.find(c => c.san === san)!
            expect(node).toBeTruthy()
        }
    })

    it('collects a per-game parse error without failing the whole import', () => {
        const text = [
            game('1. d4 Nf6 *'),
            game('1. d4 Zz9 *'), // illegal/unparseable move
        ].join('\n')
        const result = parseRepertoirePgn(text)
        expect(result.gameCount).toBe(2)
        expect(result.mergedGameCount).toBe(1)
        expect(result.parseErrors).toHaveLength(1)
    })

    it('preserves comments attached to a move', () => {
        const text = game('1. d4 { Queen\'s pawn. } Nf6 *')
        const result = parseRepertoirePgn(text)
        const d4 = result.tree.children[0]!
        expect(d4.san).toBe('d4')
        expect(d4.comment).toContain('pawn')
    })
})

describe('extractDrillUnits', () => {
    it('bundles a fully forced line into a single unit', () => {
        const { moves, rootFen } = parsePgnMoveTree(game('1. d4 Nf6 2. Bf4 d5 3. e3 *'))
        const tree = mergeRepertoireGames([{ rootFen, moves, sourceLabel: 'test' }])
        const units = extractDrillUnits(tree, 'w')

        expect(units).toHaveLength(1)
        expect(units[0]!.setupUci).toEqual([])
        expect(units[0]!.steps.map(s => s.ownerSan)).toEqual(['d4', 'Bf4', 'e3'])
        expect(units[0]!.steps[0]!.opponentReplySan).toBe('Nf6')
        expect(units[0]!.steps[1]!.opponentReplySan).toBe('d5')
        expect(units[0]!.steps[2]!.opponentReplySan).toBeUndefined()
    })

    it('splits into separate units where the opponent branches', () => {
        const text = [
            game('1. d4 d5 2. Bf4 *'),
            game('1. d4 Nf6 2. Bf4 *'),
        ].join('\n')
        const { tree } = parseRepertoirePgn(text)
        const units = extractDrillUnits(tree, 'w')

        // d4 is a single shared owner move (one unit), then Black branches into d5/Nf6,
        // each starting its own fresh unit for White's reply (Bf4 in both cases).
        expect(units).toHaveLength(3)
        const d4Unit = units.find(u => u.steps.length === 1 && u.steps[0]!.ownerSan === 'd4')
        expect(d4Unit).toBeTruthy()
        expect(d4Unit!.steps[0]!.opponentReplyUci).toBeUndefined() // branches, no single forced reply

        const bf4Units = units.filter(u => u.steps[0]?.ownerSan === 'Bf4')
        expect(bf4Units).toHaveLength(2)
        expect(bf4Units[0]!.setupUci).not.toEqual(bf4Units[1]!.setupUci)
    })

    it('splits into separate units where the owner has recorded multiple replies', () => {
        const text = [
            game('1. d4 Nf6 2. Bf4 *'),
            game('1. d4 Nf6 2. Nf3 *'),
        ].join('\n')
        const { tree } = parseRepertoirePgn(text)
        const units = extractDrillUnits(tree, 'w')

        // d4 is one shared unit (single forced Black reply Nf6), then White's own
        // node branches into Bf4 / Nf3 — two separate units.
        expect(units).toHaveLength(3)
        const secondMoveUnits = units.filter(u => u.setupUci.length === 2)
        expect(secondMoveUnits.map(u => u.steps[0]!.ownerSan).sort()).toEqual(['Bf4', 'Nf3'])
    })

    it('carries the tested move comment on its step', () => {
        const text = game('1. d4 { Solid start. } Nf6 2. Bf4 *')
        const { tree } = parseRepertoirePgn(text)
        const units = extractDrillUnits(tree, 'w')
        expect(units[0]!.steps[0]!.comment).toContain('Solid start')
    })

    it('returns nothing for an empty tree', () => {
        const { tree } = parseRepertoirePgn('')
        expect(extractDrillUnits(tree, 'w')).toEqual([])
    })
})
