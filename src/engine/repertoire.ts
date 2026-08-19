// M11 — Personal Repertoire Import & Drill Practice (see docs/PROJECT_BRIEF.md).
//
// A purchased repertoire PGN is a multi-game file where each "game" is either
// a fully independent line (e.g. a flattened export, one branch per game) or
// a real annotated tree (nested variations + prose comments within one game).
// Both shapes redundantly re-encode a shared opening trunk across games/chapters
// — see the M11 brief note for the concrete numbers found in Kris's two files.
//
// This module: splits a multi-game PGN into individual games, parses each with
// the existing single-game parser, merges same-side games into one tree
// (coalescing identical move sequences), then extracts "drill units" — the
// real decision points worth spaced-repetition practice, per Renee's sign-off
// that repetition should target actual uncertainty, not a shared trunk.
import { Chess } from 'chess.js'
import type { GameTreeImportEntry } from '../hooks/useGameTree'
import { parsePgnMoveTree } from './pgn'

export type RepertoireSide = 'w' | 'b'

export type RepertoireNode = {
    uci: string // '' only for the synthetic root
    san: string
    fen: string // position after this node's move (starting FEN for the synthetic root)
    comment?: string
    children: RepertoireNode[]
    sourceLabels: string[]
}

export type DrillStep = {
    ownerUci: string
    ownerSan: string
    comment?: string
    /** Opponent's book reply auto-played immediately after this step, before the next tested step. */
    opponentReplyUci?: string
    opponentReplySan?: string
}

export type DrillUnit = {
    id: string
    /** Moves to auto-play, starting from the repertoire root, before the user's first tested move. */
    setupUci: string[]
    /** One or more consecutive owner moves tested in this unit (bundled when forced/unbranching). */
    steps: DrillStep[]
    sourceLabels: string[]
}

export type RepertoireParseResult = {
    tree: RepertoireNode
    rootFen: string
    /** Games found in the raw PGN, including any excluded overview/outline games. */
    gameCount: number
    /** Games actually merged into the tree. */
    mergedGameCount: number
    /** Per-game parse failures — the import proceeds with whatever parsed successfully. */
    parseErrors: string[]
}

function sideToMoveFromFen(fen: string): RepertoireSide {
    return fen.split(/\s+/)[1] === 'b' ? 'b' : 'w'
}

function uciFromMove(move: GameTreeImportEntry['move']): string {
    return `${move.from}${move.to}${move.promotion ?? ''}`
}

/**
 * Splits a multi-game PGN file into individual single-game PGN texts, each of
 * which can be handed to parsePgnMoveTree (which rejects multi-game text by
 * design for normal single-game import). Splits on each `[Event` header line,
 * since every well-formed PGN game starts with one.
 */
export function splitPgnGames(pgnText: string): string[] {
    // Strip a leading UTF-8 BOM — otherwise it shifts the very first "[Event"
    // line so `^` (line-start) never matches it, silently dropping game 1.
    const text = pgnText.replace(/^\uFEFF/, '')
    const eventLineStarts = /^\[Event\b/gm
    const indices: number[] = []
    let match: RegExpExecArray | null
    while ((match = eventLineStarts.exec(text))) {
        indices.push(match.index)
    }
    if (indices.length === 0) {
        return text.trim() ? [text] : []
    }

    const chunks: string[] = []
    for (let i = 0; i < indices.length; i += 1) {
        const start = indices[i]!
        const end = i + 1 < indices.length ? indices[i + 1]! : text.length
        const chunk = text.slice(start, end).trim()
        if (chunk) chunks.push(chunk)
    }
    return chunks
}

// Identified during implementation, not guessed at spec time: the Caro course
// file's overview/table-of-contents game is reliably tagged White="Course
// Outline" — a more precise signal than "no distinct Black label" (which would
// also wrongly exclude every London game, since that file never labels either
// side at all and relies on ECO tags instead).
function isOverviewGame(headers: Record<string, string>): boolean {
    return headers.White?.trim().toLowerCase() === 'course outline'
}

function repertoireSourceLabel(headers: Record<string, string>): string {
    const black = headers.Black?.trim()
    if (black && black !== '?') return black
    const eco = headers.ECO?.trim()
    if (eco) return eco
    const white = headers.White?.trim()
    if (white && white !== '?') return white
    return 'Untitled'
}

function mergeEntries(parent: RepertoireNode, entries: GameTreeImportEntry[], sourceLabel: string): void {
    for (const entry of entries) {
        const uci = uciFromMove(entry.move)
        let existing = parent.children.find(child => child.uci === uci)
        if (!existing) {
            existing = {
                uci,
                san: entry.move.san,
                fen: entry.fen,
                comment: entry.comment,
                children: [],
                sourceLabels: [],
            }
            parent.children.push(existing)
        } else if (!existing.comment && entry.comment) {
            existing.comment = entry.comment
        }
        if (!existing.sourceLabels.includes(sourceLabel)) existing.sourceLabels.push(sourceLabel)
        mergeEntries(existing, entry.children ?? [], sourceLabel)
    }
}

export function mergeRepertoireGames(
    games: Array<{ rootFen: string; moves: GameTreeImportEntry[]; sourceLabel: string }>,
    fallbackRootFen: string = new Chess().fen(),
): RepertoireNode {
    const rootFen = games[0]?.rootFen ?? fallbackRootFen
    const root: RepertoireNode = { uci: '', san: '', fen: rootFen, children: [], sourceLabels: [] }
    for (const game of games) {
        if (game.rootFen !== rootFen) continue // mismatched starting position; surfaced via parseErrors by the caller if it matters
        mergeEntries(root, game.moves, game.sourceLabel)
    }
    return root
}

/** Parses every game in a repertoire PGN and merges them into one tree, skipping unparseable or overview games. */
export function parseRepertoirePgn(pgnText: string): RepertoireParseResult {
    const chunks = splitPgnGames(pgnText)
    const parseErrors: string[] = []
    const parsedGames: Array<{ rootFen: string; moves: GameTreeImportEntry[]; sourceLabel: string }> = []

    for (const chunk of chunks) {
        try {
            const { headers, rootFen, moves } = parsePgnMoveTree(chunk)
            if (isOverviewGame(headers)) continue
            parsedGames.push({ rootFen, moves, sourceLabel: repertoireSourceLabel(headers) })
        } catch (error) {
            parseErrors.push(error instanceof Error ? error.message : String(error))
        }
    }

    const tree = mergeRepertoireGames(parsedGames)
    return {
        tree,
        rootFen: tree.fen,
        gameCount: chunks.length,
        mergedGameCount: parsedGames.length,
        parseErrors,
    }
}

/**
 * Walks a merged repertoire tree and extracts drill units — per Renee's sign-off,
 * one unit per real decision point rather than one per raw source line. A unit
 * bundles a run of forced/unbranching owner moves together (auto-playing the
 * opponent's single recorded reply between them) and only splits into separate
 * units where the tree actually branches, on either side.
 */
export function extractDrillUnits(tree: RepertoireNode, ownerColor: RepertoireSide): DrillUnit[] {
    const units: DrillUnit[] = []
    if (tree.children.length === 0) return units

    const rootSide = sideToMoveFromFen(tree.fen)
    for (const child of tree.children) {
        walk(child, rootSide, [], null, units, ownerColor)
    }
    return units

    function walk(
        node: RepertoireNode,
        moverColor: RepertoireSide,
        setup: string[],
        current: DrillUnit | null,
        allUnits: DrillUnit[],
        owner: RepertoireSide,
    ): void {
        const opponentColor: RepertoireSide = moverColor === 'w' ? 'b' : 'w'

        if (moverColor === owner) {
            let unit = current
            if (!unit) {
                unit = { id: [...setup, node.uci].join(','), setupUci: [...setup], steps: [], sourceLabels: [] }
            }
            unit.steps.push({ ownerUci: node.uci, ownerSan: node.san, comment: node.comment })
            for (const label of node.sourceLabels) {
                if (!unit.sourceLabels.includes(label)) unit.sourceLabels.push(label)
            }

            if (node.children.length === 0) {
                allUnits.push(unit)
                return
            }
            if (node.children.length > 1) {
                allUnits.push(unit)
                for (const grandchild of node.children) {
                    walk(grandchild, opponentColor, [...setup, node.uci], null, allUnits, owner)
                }
                return
            }
            const onlyReply = node.children[0]!
            const lastStep = unit.steps[unit.steps.length - 1]!
            lastStep.opponentReplyUci = onlyReply.uci
            lastStep.opponentReplySan = onlyReply.san
            walk(onlyReply, opponentColor, [...setup, node.uci], unit, allUnits, owner)
            return
        }

        // node.uci was played by the opponent; node.children are the owner's recorded replies.
        if (node.children.length === 0) {
            if (current) allUnits.push(current)
            return
        }
        if (node.children.length > 1) {
            if (current) allUnits.push(current)
            for (const child of node.children) {
                walk(child, owner, [...setup, node.uci], null, allUnits, owner)
            }
            return
        }
        const onlyChild = node.children[0]!
        walk(onlyChild, owner, [...setup, node.uci], current, allUnits, owner)
    }
}
