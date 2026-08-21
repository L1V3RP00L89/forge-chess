import { describe, expect, it } from 'vitest'
import {
    computeStreakUpdate,
    isCheckpointWeek,
    isPlanComplete,
    weekNumberForDate,
    weeklyFocusForWeek,
} from './trainingPlan'

describe('weekNumberForDate', () => {
    it('is week 1 on the start date', () => {
        expect(weekNumberForDate('2026-08-20T00:00:00.000Z', new Date('2026-08-20T12:00:00.000Z'))).toBe(1)
    })

    it('advances to week 2 after 7 days', () => {
        expect(weekNumberForDate('2026-08-20T00:00:00.000Z', new Date('2026-08-27T00:00:01.000Z'))).toBe(2)
    })

    it('caps at week 13 (plan complete) past week 12', () => {
        expect(weekNumberForDate('2026-08-20T00:00:00.000Z', new Date('2027-01-01T00:00:00.000Z'))).toBe(13)
    })
})

describe('isPlanComplete', () => {
    it('is false through week 12', () => {
        expect(isPlanComplete(12)).toBe(false)
    })

    it('is true at week 13', () => {
        expect(isPlanComplete(13)).toBe(true)
    })
})

describe('weeklyFocusForWeek', () => {
    it('rotates Woodpecker -> Opening -> Strategy -> Endgame every 4 weeks', () => {
        expect(weeklyFocusForWeek(1)).toBe('Woodpecker')
        expect(weeklyFocusForWeek(2)).toBe('Opening Review')
        expect(weeklyFocusForWeek(3)).toBe('Strategy Review')
        expect(weeklyFocusForWeek(4)).toBe('Endgame Review')
        expect(weeklyFocusForWeek(5)).toBe('Woodpecker')
        expect(weeklyFocusForWeek(9)).toBe('Woodpecker')
    })
})

describe('isCheckpointWeek', () => {
    it('flags weeks 5, 7, and 12', () => {
        expect(isCheckpointWeek(5)).toBe(true)
        expect(isCheckpointWeek(7)).toBe(true)
        expect(isCheckpointWeek(12)).toBe(true)
    })

    it('does not flag a non-checkpoint week', () => {
        expect(isCheckpointWeek(6)).toBe(false)
    })
})

describe('computeStreakUpdate', () => {
    const empty = { currentStreak: 0, longestStreak: 0, lastActiveDate: null }

    it('starts a streak at 1 on first Base Work', () => {
        expect(computeStreakUpdate(empty, '2026-08-20')).toEqual({
            currentStreak: 1,
            longestStreak: 1,
            lastActiveDate: '2026-08-20',
        })
    })

    it('is a no-op if Base Work was already logged today', () => {
        const state = { currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-08-20' }
        expect(computeStreakUpdate(state, '2026-08-20')).toEqual(state)
    })

    it('increments the streak on a consecutive day', () => {
        const state = { currentStreak: 3, longestStreak: 5, lastActiveDate: '2026-08-20' }
        expect(computeStreakUpdate(state, '2026-08-21')).toEqual({
            currentStreak: 4,
            longestStreak: 5,
            lastActiveDate: '2026-08-21',
        })
    })

    it('raises longestStreak when the current streak passes it', () => {
        const state = { currentStreak: 5, longestStreak: 5, lastActiveDate: '2026-08-20' }
        expect(computeStreakUpdate(state, '2026-08-21')).toEqual({
            currentStreak: 6,
            longestStreak: 6,
            lastActiveDate: '2026-08-21',
        })
    })

    it('resets to 1 after a gap day, keeping longestStreak', () => {
        const state = { currentStreak: 5, longestStreak: 5, lastActiveDate: '2026-08-18' }
        expect(computeStreakUpdate(state, '2026-08-21')).toEqual({
            currentStreak: 1,
            longestStreak: 5,
            lastActiveDate: '2026-08-21',
        })
    })
})
