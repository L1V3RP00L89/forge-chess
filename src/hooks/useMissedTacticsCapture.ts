import { useEffect } from 'react'
import { coachRevealEvents, COACH_REVEAL_EVENT, type CoachRevealEvent } from '../engine/coachEvents'
import { missedTacticFromEvent } from '../engine/missedTactics'
import { useMissedTacticsDb } from './useMissedTacticsDb'

// Mounted once near the app root: turns every Coach-reveal "I didn't have
// it" outcome (tier 3, see missedTacticFromEvent) into a queued row in
// missed_tactics, so the Woodpecker panel has something to drill without
// the Coach card itself needing to know the DB exists.
export function useMissedTacticsCapture(): void {
    const { recordMiss } = useMissedTacticsDb()

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<CoachRevealEvent>).detail
            const candidate = missedTacticFromEvent(detail)
            if (candidate) void recordMiss(candidate.fen, candidate.bestMoveUci)
        }
        coachRevealEvents.addEventListener(COACH_REVEAL_EVENT, handler)
        return () => coachRevealEvents.removeEventListener(COACH_REVEAL_EVENT, handler)
    }, [recordMiss])
}
