import { describe, expect, it, vi } from 'vitest'
import {
  cloudEvalRequestKey,
  cloudEvalToSnapshot,
  cloudLineToSideToMoveScore,
  normalizeCloudEvalFen,
  parseCloudEvalResponse,
} from './cloudEval'

describe('cloud eval parsing', () => {
  it('normalizes cache keys to the position fields that affect engine eval', () => {
    const fenA = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const fenB = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 7 42'

    expect(normalizeCloudEvalFen(fenA)).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -')
    expect(cloudEvalRequestKey({ fen: fenA, multiPv: 9 })).toBe(cloudEvalRequestKey({ fen: fenB, multiPv: 5 }))
  })

  it('parses centipawn and mate PVs from Lichess responses', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    const parsed = parseCloudEvalResponse({
      fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
      knodes: 106325,
      depth: 29,
      pvs: [
        { moves: 'd1e2 d8e7 a2a4', cp: 41 },
        { moves: 'c2c3 a7a6 b5a4', mate: -6 },
        { moves: '', cp: 12 },
      ],
    })

    expect(parsed).toEqual({
      fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq -',
      knodes: 106325,
      depth: 29,
      fetchedAt: 1_700_000_000_000,
      pvs: [
        { moves: ['d1e2', 'd8e7', 'a2a4'], cp: 41 },
        { moves: ['c2c3', 'a7a6', 'b5a4'], mate: -6 },
      ],
    })

    vi.useRealTimers()
  })

  it('converts White POV cloud scores into side-to-move snapshots', () => {
    const result = parseCloudEvalResponse({
      fen: '8/8/8/8/8/8/4k3/4K3 b - -',
      knodes: 12,
      depth: 35,
      pvs: [{ moves: 'e2d2 e1d1', cp: 80 }],
    })

    expect(result).not.toBeNull()
    expect(cloudLineToSideToMoveScore('8/8/8/8/8/8/4k3/4K3 b - - 0 1', result!.pvs[0]!)).toEqual({ cp: -80 })
    expect(cloudEvalToSnapshot('8/8/8/8/8/8/4k3/4K3 b - - 0 1', result!)).toMatchObject({
      cp: -80,
      depth: 35,
      nodes: 12_000,
      mode: 'custom',
      purpose: 'cloud-eval',
    })
  })
})
