import { Chess } from 'chess.js'
import type { GameNode } from '../hooks/useGameTree'
import type { EvalSnapshot } from './analysis'

const INITIAL_FEN = new Chess().fen()

export function rootFenFromPgnHeaders(headers: Record<string, string>): string {
    const fenHeader = headers.FEN?.trim()
    if (!fenHeader) return INITIAL_FEN

    return new Chess(fenHeader).fen()
}

export function exportAnnotatedPgn(
    mainLine: GameNode[],
    evaluationsByFen: Map<string, EvalSnapshot>,
    header: Record<string, string> = {}
): string {
    let pgn = ''
    const rootFen = mainLine[0]?.fen ? new Chess(mainLine[0].fen).fen() : INITIAL_FEN
    const rootPosition = new Chess(rootFen)

    // Set headers (Event, Site, Date, Round, White, Black, Result)
    const defaultHeaders: Record<string, string> = {
        Event: 'Web Chess Game',
        Site: 'Localhost',
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

    for (const [key, value] of Object.entries({ ...defaultHeaders, ...header })) {
        pgn += `[${key} "${value}"]\n`
    }
    pgn += '\n'

    let moveNumber = rootPosition.moveNumber()
    let sideToMove = rootPosition.turn()
    let currentLine = ''

    // mainLine[0] is root. mainLine[1] is the first move.
    for (let i = 1; i < mainLine.length; i++) {
        const node = mainLine[i]
        if (!node || !node.move) continue

        if (sideToMove === 'w') {
            currentLine += `${moveNumber}. ${node.san} `
        } else {
            currentLine += `${moveNumber}... ${node.san} `
        }

        // Lookup evaluation
        const evaluation = evaluationsByFen.get(node.fen)
        if (evaluation) {
            // Normalize to White's perspective since Stockfish outputs from side-to-move's perspective
            const turn = node.fen.split(' ')[1]
            const cpPov = turn === 'w' ? evaluation.cp : -evaluation.cp

            let evalStr = ''
            if (typeof evaluation.mate === 'number') {
                const matePov = turn === 'w' ? evaluation.mate : -evaluation.mate
                evalStr = `#${matePov}`
            } else if (Math.abs(cpPov) >= 10000) {
                evalStr = cpPov > 0 ? '#1' : '#-1'
            } else {
                const cpVal = cpPov / 100
                evalStr = cpVal.toFixed(2)
            }

            currentLine += `{ [%eval ${evalStr}] } `
        }

        // Wrap to ~80 chars
        if (currentLine.length > 70) {
            pgn += currentLine.trim() + '\n'
            currentLine = ''
        }

        if (sideToMove === 'b') moveNumber += 1
        sideToMove = sideToMove === 'w' ? 'b' : 'w'
    }

    if (currentLine.trim()) {
        pgn += currentLine.trim()
    }

    // Append result at the very end
    pgn += ` ${(header.Result ?? defaultHeaders.Result)}`

    return pgn.trim() + '\n'
}
