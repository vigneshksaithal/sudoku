import { describe, expect, test } from 'vitest'

import {
    advanceFeaturedStreak,
    calculateAdjustedTime,
    updateDailyGoalsState,
} from '../community-engagement'

describe('calculateAdjustedTime', () => {
    test('adds time, hint penalties, and validation penalties', () => {
        expect(calculateAdjustedTime({
            elapsedSeconds: 120,
            hintsUsed: 2,
            validationFailures: 1,
        })).toBe(225)
    })
})

describe('advanceFeaturedStreak', () => {
    test('starts a new streak on first featured completion', () => {
        expect(advanceFeaturedStreak({
            currentStreak: 0,
            longestStreak: 0,
            freezeCount: 0,
            lastFeaturedDay: null,
            completedDay: '2026-04-20',
        })).toEqual({
            currentStreak: 1,
            longestStreak: 1,
            freezeCount: 0,
            usedFreeze: false,
        })
    })

    test('increments streak on consecutive days', () => {
        expect(advanceFeaturedStreak({
            currentStreak: 3,
            longestStreak: 3,
            freezeCount: 0,
            lastFeaturedDay: '2026-04-19',
            completedDay: '2026-04-20',
        })).toEqual({
            currentStreak: 4,
            longestStreak: 4,
            freezeCount: 0,
            usedFreeze: false,
        })
    })

    test('auto-consumes a freeze after one missed day', () => {
        expect(advanceFeaturedStreak({
            currentStreak: 5,
            longestStreak: 5,
            freezeCount: 1,
            lastFeaturedDay: '2026-04-18',
            completedDay: '2026-04-20',
        })).toEqual({
            currentStreak: 6,
            longestStreak: 6,
            freezeCount: 0,
            usedFreeze: true,
        })
    })

    test('resets streak after a gap with no freeze', () => {
        expect(advanceFeaturedStreak({
            currentStreak: 5,
            longestStreak: 8,
            freezeCount: 0,
            lastFeaturedDay: '2026-04-18',
            completedDay: '2026-04-20',
        })).toEqual({
            currentStreak: 1,
            longestStreak: 8,
            freezeCount: 0,
            usedFreeze: false,
        })
    })

    test('awards a freeze at seven-day milestones up to a max of two', () => {
        expect(advanceFeaturedStreak({
            currentStreak: 6,
            longestStreak: 6,
            freezeCount: 1,
            lastFeaturedDay: '2026-04-19',
            completedDay: '2026-04-20',
        })).toEqual({
            currentStreak: 7,
            longestStreak: 7,
            freezeCount: 2,
            usedFreeze: false,
        })
    })
})

describe('updateDailyGoalsState', () => {
    test('marks all applicable daily goals from a completion', () => {
        expect(updateDailyGoalsState({
            currentGoals: {
                featuredRace: false,
                hintFreeAny: false,
                beatPersonalBest: false,
            },
            mode: 'featured',
            hintsUsed: 0,
            beatPersonalBest: true,
        })).toEqual({
            featuredRace: true,
            hintFreeAny: true,
            beatPersonalBest: true,
        })
    })
})
