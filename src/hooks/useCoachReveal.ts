import { useCallback, useEffect, useRef, useState } from 'react'
import { emitCoachRevealEvent, type CoachRevealTier } from '../engine/coachEvents'

export type CoachRevealState = {
    /** Whether the reveal is staged at all — false (Pro mode) always sits at the full tier. */
    gated: boolean
    effectiveTier: CoachRevealTier
    outcomeGiven: boolean
    revealNextTier: () => void
    recordOutcome: (outcome: 'found' | 'missed') => void
}

/**
 * Coach mode withholds the answer behind three tiers — plan/idea tags, then a
 * destination-square nudge, then the full move/reply/line — so a sub-1400
 * player gets productive struggle instead of a spoiler curtain. Pro mode
 * (gated=false) always renders at the full tier.
 */
export function useCoachReveal(fen: string, bestMoveUci: string | null | undefined, gated: boolean): CoachRevealState {
    const tierRef = useRef<CoachRevealTier>(0)
    // Captured once, when the user first engages the reveal (tier 0 → 1) —
    // not continuously synced from the live fen/bestMoveUci, which can
    // already reflect the *next* position by the time a cleanup runs.
    const snapshotRef = useRef<{ fen: string; bestMoveUci: string | null } | null>(null)
    const outcomeRecordedRef = useRef(false)
    const [tier, setTierState] = useState<CoachRevealTier>(0)
    const [outcomeGiven, setOutcomeGiven] = useState(false)

    useEffect(() => {
        tierRef.current = 0
        snapshotRef.current = null
        outcomeRecordedRef.current = false
        setTierState(0)
        setOutcomeGiven(false)

        return () => {
            // Leaving this position: if the user engaged the reveal but never
            // said whether they'd found the move themselves, log it as
            // unrated rather than dropping the signal on the floor (M8 hook).
            if (tierRef.current > 0 && !outcomeRecordedRef.current && snapshotRef.current) {
                emitCoachRevealEvent({
                    ...snapshotRef.current,
                    tier: tierRef.current,
                    outcome: 'unrated',
                })
            }
        }
    }, [fen])

    const revealNextTier = useCallback(() => {
        snapshotRef.current ??= { fen, bestMoveUci: bestMoveUci ?? null }
        setTierState(current => {
            const next = Math.min(3, current + 1) as CoachRevealTier
            tierRef.current = next
            return next
        })
    }, [fen, bestMoveUci])

    const recordOutcome = useCallback((outcome: 'found' | 'missed') => {
        outcomeRecordedRef.current = true
        setOutcomeGiven(true)
        emitCoachRevealEvent({
            ...(snapshotRef.current ?? { fen, bestMoveUci: bestMoveUci ?? null }),
            tier: tierRef.current,
            outcome,
        })
    }, [fen, bestMoveUci])

    return {
        gated,
        effectiveTier: gated ? tier : 3,
        outcomeGiven,
        revealNextTier,
        recordOutcome,
    }
}
