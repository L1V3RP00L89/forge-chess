import { describe, expect, it } from 'vitest'
import { COACH_REVEAL_EVENT, coachRevealEvents, emitCoachRevealEvent, type CoachRevealEvent } from './coachEvents'

describe('coach reveal events', () => {
  it('dispatches a CustomEvent with the reveal detail', () => {
    const received: CoachRevealEvent[] = []
    const listener = (event: Event) => {
      received.push((event as CustomEvent<CoachRevealEvent>).detail)
    }

    coachRevealEvents.addEventListener(COACH_REVEAL_EVENT, listener)
    try {
      emitCoachRevealEvent({ fen: 'startpos', bestMoveUci: 'e2e4', tier: 2, outcome: 'missed' })
    } finally {
      coachRevealEvents.removeEventListener(COACH_REVEAL_EVENT, listener)
    }

    expect(received).toEqual([
      { fen: 'startpos', bestMoveUci: 'e2e4', tier: 2, outcome: 'missed' },
    ])
  })
})
