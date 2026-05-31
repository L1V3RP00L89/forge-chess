import { describe, expect, it } from 'vitest'
import { parseInfoLine } from './useStockfishEngine'

describe('Stockfish engine output parsing', () => {
  it('parses finite score, telemetry, WDL, and PV values from info lines', () => {
    expect(parseInfoLine('info depth 16 multipv 2 score cp -34 nodes 12000 nps 300000 time 40 wdl 42 900 58 pv e2e4 e7e5')).toEqual({
      cp: -34,
      depth: 16,
      multipv: 2,
      nodes: 12000,
      nps: 300000,
      pv: ['e2e4', 'e7e5'],
      time: 40,
      wdl: { w: 42, d: 900, l: 58 },
    })
  })

  it('drops malformed numeric fields instead of leaking NaN into evaluations', () => {
    expect(parseInfoLine('info depth nope multipv 0 score cp NaN nodes Infinity nps bad time -1 wdl 1 bad 2 pv d2d4 d7d5')).toEqual({
      cp: undefined,
      depth: 0,
      multipv: 1,
      nodes: undefined,
      nps: undefined,
      pv: ['d2d4', 'd7d5'],
      time: undefined,
      wdl: undefined,
    })
  })

  it('ignores lines without principal variations', () => {
    expect(parseInfoLine('info depth 20 score cp 12 nodes 5000')).toBeNull()
  })
})
