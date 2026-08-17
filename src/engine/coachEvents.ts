// Signal for the M8 Woodpecker drill queue: which reveal tier a user needed
// before the answer, and whether they'd already found it themselves. No
// consumer exists yet — this only decouples the emitter from that future
// subscriber so M8 doesn't have to retrofit the Coach card later.

export type CoachRevealTier = 0 | 1 | 2 | 3

export type CoachRevealOutcome = 'found' | 'missed' | 'unrated'

export type CoachRevealEvent = {
  fen: string
  bestMoveUci: string | null
  tier: CoachRevealTier
  outcome: CoachRevealOutcome
}

export const COACH_REVEAL_EVENT = 'coach-reveal'

// A dedicated bus rather than `window` — keeps this testable without a DOM
// environment and avoids leaking onto the global event target.
export const coachRevealEvents = new EventTarget()

export function emitCoachRevealEvent(event: CoachRevealEvent): void {
  coachRevealEvents.dispatchEvent(new CustomEvent<CoachRevealEvent>(COACH_REVEAL_EVENT, { detail: event }))
}
