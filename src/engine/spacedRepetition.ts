// Shared spaced-repetition scheduling, used by M11's repertoire drills today
// and intended for M8's Woodpecker tactics queue once that's built (same
// next_review_at/review_count/solved_streak column shape in both tables).
//
// Deliberately simple, not full SM-2: a miss always resets the streak and
// requeues soon (same session); a hit advances the streak and pushes the
// interval out along a fixed schedule. Good enough for "did I actually learn
// this" without configurable ease factors nobody asked for.
const INTERVAL_DAYS_BY_STREAK = [1, 3, 7, 14, 30, 60]
const MISS_REQUEUE_MINUTES = 10

export type ReviewState = {
    nextReviewAt: string
    reviewCount: number
    solvedStreak: number
}

export function computeNextReview(
    current: Pick<ReviewState, 'reviewCount' | 'solvedStreak'>,
    correct: boolean,
    now: Date = new Date(),
): ReviewState {
    const reviewCount = current.reviewCount + 1

    if (!correct) {
        const next = new Date(now.getTime() + MISS_REQUEUE_MINUTES * 60_000)
        return { nextReviewAt: next.toISOString(), reviewCount, solvedStreak: 0 }
    }

    const solvedStreak = current.solvedStreak + 1
    const intervalDays = INTERVAL_DAYS_BY_STREAK[Math.min(solvedStreak - 1, INTERVAL_DAYS_BY_STREAK.length - 1)]!
    const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60_000)
    return { nextReviewAt: next.toISOString(), reviewCount, solvedStreak }
}
