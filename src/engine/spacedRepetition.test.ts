import { describe, expect, it } from 'vitest'
import { computeNextReview } from './spacedRepetition'

const NOW = new Date('2026-08-20T12:00:00.000Z')

describe('computeNextReview', () => {
    it('resets the streak and requeues soon on a miss', () => {
        const result = computeNextReview({ reviewCount: 3, solvedStreak: 4 }, false, NOW)
        expect(result.solvedStreak).toBe(0)
        expect(result.reviewCount).toBe(4)
        expect(new Date(result.nextReviewAt).getTime()).toBe(NOW.getTime() + 10 * 60_000)
    })

    it('advances the streak and pushes the interval out on a hit', () => {
        const result = computeNextReview({ reviewCount: 0, solvedStreak: 0 }, true, NOW)
        expect(result.solvedStreak).toBe(1)
        expect(result.reviewCount).toBe(1)
        expect(new Date(result.nextReviewAt).getTime()).toBe(NOW.getTime() + 1 * 24 * 60 * 60_000)
    })

    it('lengthens the interval as the streak grows', () => {
        const first = computeNextReview({ reviewCount: 0, solvedStreak: 0 }, true, NOW)
        const second = computeNextReview({ reviewCount: first.reviewCount, solvedStreak: first.solvedStreak }, true, NOW)
        const firstDelay = new Date(first.nextReviewAt).getTime() - NOW.getTime()
        const secondDelay = new Date(second.nextReviewAt).getTime() - NOW.getTime()
        expect(secondDelay).toBeGreaterThan(firstDelay)
    })

    it('caps the interval instead of growing forever', () => {
        let state = { reviewCount: 0, solvedStreak: 0 }
        for (let i = 0; i < 10; i += 1) {
            state = computeNextReview(state, true, NOW)
        }
        const capped = computeNextReview(state, true, NOW)
        expect(new Date(capped.nextReviewAt).getTime() - NOW.getTime()).toBe(60 * 24 * 60 * 60_000)
    })
})
