import { Chess } from 'chess.js'
import { parse as parsePgn } from 'chess.js/src/pgn.js'
import type { Node as ParsedPgnNode } from 'chess.js/src/node'
import type { GameNode, GameTreeImportEntry } from '../hooks/useGameTree'
import type { EvalSnapshot } from './analysis'
import { hasLegalKingPlacement } from './fen'

const INITIAL_FEN = new Chess().fen()
const PGN_TAG_NAME_PATTERN = /^[A-Za-z0-9_]+$/
const VALID_PGN_RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*'])
const QUALITY_EXPORT_LABELS: Record<NonNullable<GameNode['quality']>, string> = {
    best: 'Best',
    good: 'Good',
    inaccuracy: 'Inaccuracy',
    mistake: 'Mistake',
    blunder: 'Blunder',
    pending: 'Pending',
}

function sanitizePgnHeaderValue(value: string): string {
    return value
        .replace(/[\r\n]+/g, ' ')
        .replace(/"/g, "'")
}

function normalizePgnResult(result: string | undefined): string {
    const normalized = result?.trim()
    return normalized && VALID_PGN_RESULTS.has(normalized) ? normalized : '*'
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function bestMoveSanFromFen(fen: string, bestMove: string): string {
    if (bestMove.length < 4) return bestMove

    try {
        const replay = new Chess(fen)
        const move = replay.move({
            from: bestMove.slice(0, 2),
            to: bestMove.slice(2, 4),
            promotion: bestMove[4],
        })
        return move?.san ?? bestMove
    } catch {
        return bestMove
    }
}

function movePrefixFromFen(fen: string): string {
    const position = new Chess(fen)
    const moveNumber = position.moveNumber()
    return position.turn() === 'w' ? `${moveNumber}.` : `${moveNumber}...`
}

function commentForNode(
    node: GameNode,
    parentFen: string,
    evaluationsByFen: Map<string, EvalSnapshot>,
): string | null {
    const commentParts: string[] = []
    const evaluation = evaluationsByFen.get(node.fen)

    if (evaluation) {
        const turn = node.fen.split(' ')[1]
        const cpPov = isFiniteNumber(evaluation.cp)
            ? turn === 'w' ? evaluation.cp : -evaluation.cp
            : undefined

        let evalStr: string | null = null
        if (isFiniteNumber(evaluation.mate)) {
            const matePov = turn === 'w' ? evaluation.mate : -evaluation.mate
            evalStr = `#${matePov}`
        } else if (typeof cpPov === 'number' && Math.abs(cpPov) >= 10000) {
            evalStr = cpPov > 0 ? '#1' : '#-1'
        } else if (typeof cpPov === 'number') {
            const cpVal = cpPov / 100
            evalStr = cpVal.toFixed(2)
        }

        if (evalStr) commentParts.push(`[%eval ${evalStr}]`)
    }

    const beforeEvaluation = evaluationsByFen.get(parentFen)
    if (beforeEvaluation?.bestMove && beforeEvaluation.bestMove !== node.uci) {
        commentParts.push(`Best ${bestMoveSanFromFen(parentFen, beforeEvaluation.bestMove)}`)
    }

    if (node.quality && node.quality !== 'pending') {
        commentParts.push(QUALITY_EXPORT_LABELS[node.quality])
    }

    return commentParts.length ? `{ ${commentParts.join('; ')} }` : null
}

function wrapMovetext(tokens: string[], result: string): string {
    const outputTokens = [...tokens, result]
    const lines: string[] = []
    let currentLine = ''

    for (const token of outputTokens) {
        if (!currentLine) {
            currentLine = token
            continue
        }

        if (currentLine.length + token.length + 1 > 70) {
            lines.push(currentLine)
            currentLine = token
            continue
        }

        currentLine += ` ${token}`
    }

    if (currentLine) lines.push(currentLine)
    return lines.join('\n')
}

export function rootFenFromPgnHeaders(headers: Record<string, string>): string {
    const fenHeader = headers.FEN?.trim()
    if (!fenHeader) return INITIAL_FEN

    const fen = new Chess(fenHeader).fen()
    if (!hasLegalKingPlacement(fen)) throw new Error('Invalid FEN king placement.')
    return fen
}

function firstMoveNode(node: ParsedPgnNode): ParsedPgnNode | null {
    if (node.move) return node
    for (const variation of node.variations) {
        const child = firstMoveNode(variation)
        if (child) return child
    }
    return null
}

function buildImportEntry(node: ParsedPgnNode, position: Chess): GameTreeImportEntry | null {
    const moveNode = firstMoveNode(node)
    if (!moveNode?.move) return null

    const nextPosition = new Chess(position.fen())
    const move = nextPosition.move(moveNode.move)
    if (!move) throw new Error(`Invalid move in PGN: ${moveNode.move}`)

    return {
        move,
        fen: nextPosition.fen(),
        children: buildImportEntries(moveNode.variations, nextPosition),
    }
}

function buildImportEntries(nodes: ParsedPgnNode[], position: Chess): GameTreeImportEntry[] {
    return nodes
        .map(node => buildImportEntry(node, position))
        .filter((entry): entry is GameTreeImportEntry => entry !== null)
}

export function parsePgnMoveTree(pgnText: string): {
    headers: Record<string, string>
    rootFen: string
    moves: GameTreeImportEntry[]
    result?: string
} {
    const parsed = parsePgn(pgnText)
    const rootFen = rootFenFromPgnHeaders(parsed.headers)
    const rootPosition = new Chess(rootFen)

    return {
        headers: parsed.headers,
        rootFen,
        moves: buildImportEntries(parsed.root.variations, rootPosition),
        result: parsed.result,
    }
}

export function flattenPgnMainLine(entries: GameTreeImportEntry[]): Array<{ move: GameTreeImportEntry['move']; fen: string }> {
    const line: Array<{ move: GameTreeImportEntry['move']; fen: string }> = []
    let current: GameTreeImportEntry | undefined = entries[0]

    while (current) {
        line.push({ move: current.move, fen: current.fen })
        current = current.children?.[0]
    }

    return line
}

export function exportAnnotatedPgn(
    mainLine: GameNode[],
    evaluationsByFen: Map<string, EvalSnapshot>,
    header: Record<string, string> = {},
    allNodes?: Map<string, GameNode>
): string {
    let pgn = ''
    const rootFen = mainLine[0]?.fen ? new Chess(mainLine[0].fen).fen() : INITIAL_FEN

    // Set headers (Event, Site, Date, Round, White, Black, Result)
    const defaultHeaders: Record<string, string> = {
        Event: 'Web Chess Game',
        Site: 'Web Chess',
        Date: new Date().toISOString().split('T')[0]!.replace(/-/g, '.'),
        Round: '1',
        White: 'Player 1',
        Black: 'Player 2',
        Result: '*',
    }

    if (rootFen !== INITIAL_FEN) {
        defaultHeaders.SetUp = '1'
        defaultHeaders.FEN = rootFen
    }

    const headers = { ...defaultHeaders, ...header }
    const result = normalizePgnResult(headers.Result)
    headers.Result = result

    for (const [key, value] of Object.entries(headers)) {
        if (!PGN_TAG_NAME_PATTERN.test(key)) continue
        pgn += `[${key} "${sanitizePgnHeaderValue(value)}"]\n`
    }
    pgn += '\n'

    const nodeLookup = allNodes ?? new Map(mainLine.map(node => [node.id, node]))
    const tokens: string[] = []
    const visited = new Set<string>()

    const renderLine = (startId: string): string[] => {
        const lineTokens: string[] = []
        let node = nodeLookup.get(startId)

        while (node?.move && !visited.has(node.id)) {
            visited.add(node.id)
            const parent = node.parent ? nodeLookup.get(node.parent) : undefined
            const parentFen = parent?.fen ?? rootFen
            lineTokens.push(`${movePrefixFromFen(parentFen)} ${node.san}`)

            const comment = commentForNode(node, parentFen, evaluationsByFen)
            if (comment) lineTokens.push(comment)

            if (parent?.children[0] === node.id) {
                for (const variationId of parent.children.slice(1)) {
                    const variationTokens = renderLine(variationId)
                    if (variationTokens.length) {
                        lineTokens.push(`(${variationTokens.join(' ')})`)
                    }
                }
            }

            const nextId = node.children[0]
            node = nextId ? nodeLookup.get(nextId) : undefined
        }

        return lineTokens
    }

    const firstMove = mainLine[1]
    if (firstMove?.id) {
        tokens.push(...renderLine(firstMove.id))
    }

    pgn += wrapMovetext(tokens, result)

    return pgn.trim() + '\n'
}
