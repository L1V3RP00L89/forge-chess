// M8 Woodpecker queue: decides which Coach-reveal events (see coachEvents.ts)
// are worth queuing as a tactic to redrill.
//
// Renee's call: only an explicit tier-3 "missed" outcome counts. 'unrated'
// (the user moved on without saying found/missed) is ambiguous -- it could
// mean they solved it silently and didn't bother clicking, and queuing that
// noise directly contradicts the app's own "over-analysis is the enemy"
// principle (M4) by padding the drill queue with positions the user may
// already know. A miss below tier 3 is also meaningless: tiers 1-2 are
// idea/square hints, not the move itself, so there's nothing yet to grade
// "found" vs "missed" against.
import type { CoachRevealEvent } from './coachEvents'

export type MissedTacticCandidate = {
    fen: string
    bestMoveUci: string
}

export function missedTacticFromEvent(event: CoachRevealEvent): MissedTacticCandidate | null {
    if (event.outcome !== 'missed' || event.tier !== 3 || !event.bestMoveUci) return null
    return { fen: event.fen, bestMoveUci: event.bestMoveUci }
}
