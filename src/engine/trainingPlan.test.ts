import { describe, expect, it } from 'vitest'
import {
    baseWorkItemsForDay,
    computeStreakUpdate,
    dayInWeekForDate,
    isPlanComplete,
    isRatingCheckpointWeek,
    isSocialCheckinWeek,
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

describe('isRatingCheckpointWeek', () => {
    it('flags weeks 5 and 12 (the only two the source plan asks for a rating comparison)', () => {
        expect(isRatingCheckpointWeek(5)).toBe(true)
        expect(isRatingCheckpointWeek(12)).toBe(true)
    })

    it('does not flag week 7 -- that is a social check-in, not a rating checkpoint', () => {
        expect(isRatingCheckpointWeek(7)).toBe(false)
    })

    it('does not flag an unrelated week', () => {
        expect(isRatingCheckpointWeek(6)).toBe(false)
    })
})

describe('isSocialCheckinWeek', () => {
    it('flags only week 7', () => {
        expect(isSocialCheckinWeek(7)).toBe(true)
        expect(isSocialCheckinWeek(5)).toBe(false)
        expect(isSocialCheckinWeek(12)).toBe(false)
    })
})

describe('dayInWeekForDate', () => {
    it('is day 1 on the start date', () => {
        expect(dayInWeekForDate('2026-08-20T00:00:00.000Z', new Date('2026-08-20T12:00:00.000Z'))).toBe(1)
    })

    it('advances through day 7 and wraps back to day 1 of the next week', () => {
        expect(dayInWeekForDate('2026-08-20T00:00:00.000Z', new Date('2026-08-26T12:00:00.000Z'))).toBe(7)
        expect(dayInWeekForDate('2026-08-20T00:00:00.000Z', new Date('2026-08-27T12:00:00.000Z'))).toBe(1)
    })
})

describe('baseWorkItemsForDay', () => {
    it('is a 15+10 game + analysis on odd days (1/3/5)', () => {
        for (const day of [1, 3, 5]) {
            const items = baseWorkItemsForDay(day, 'Woodpecker')
            expect(items.map(i => i.key)).toEqual(['play-rapid', 'analyze-rapid'])
        }
    })

    it('is four 5+5 games + analysis on even days (2/4/6)', () => {
        for (const day of [2, 4, 6]) {
            const items = baseWorkItemsForDay(day, 'Woodpecker')
            expect(items.map(i => i.key)).toEqual(['play-blitz', 'analyze-blitz'])
        }
    })

    it('is the week\'s rotating review focus on day 7, with no game', () => {
        const items = baseWorkItemsForDay(7, 'Opening Review')
        expect(items).toEqual([{ key: 'review-day', label: 'Opening Review — track your time' }])
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
