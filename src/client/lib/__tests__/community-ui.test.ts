import { describe, expect, it } from 'vitest'

import type { Difficulty } from '../types'
import type { RecentCompletionEvent } from '../../../shared/community'
import {
    getDisplayDifficulty,
    getRankMovement,
    mergeRecentCompletions,
} from '../community-ui'

describe('community-ui', () => {
    it('uses the featured difficulty while the user is in featured mode', () => {
        expect(getDisplayDifficulty('featured', 'easy', 'intermediate')).toBe('intermediate')
    })

    it('uses the selected practice difficulty while the user is in practice mode', () => {
        expect(getDisplayDifficulty('practice', 'easy', 'intermediate')).toBe('easy')
    })

    it('returns a positive movement when the player climbs the leaderboard', () => {
        expect(getRankMovement(14, 6)).toBe(8)
    })

    it('returns zero movement when the player rank does not change', () => {
        expect(getRankMovement(6, 6)).toBe(0)
    })

    it('returns null when either leaderboard rank is unknown', () => {
        expect(getRankMovement(null, 6)).toBeNull()
        expect(getRankMovement(6, null)).toBeNull()
    })

    it('prepends a realtime completion event and trims the feed length', () => {
        const events: RecentCompletionEvent[] = [
            createEvent('alpha', 180, 'easy'),
            createEvent('bravo', 195, 'easy'),
            createEvent('charlie', 210, 'easy'),
            createEvent('delta', 225, 'easy'),
            createEvent('echo', 240, 'easy'),
        ]

        expect(mergeRecentCompletions(events, {
            username: 'foxtrot',
            adjustedTime: 150,
            difficulty: 'intermediate',
        }, '2026-04-20T12:00:00.000Z')).toEqual([
            createEvent('foxtrot', 150, 'intermediate'),
            createEvent('alpha', 180, 'easy'),
            createEvent('bravo', 195, 'easy'),
            createEvent('charlie', 210, 'easy'),
            createEvent('delta', 225, 'easy'),
        ])
    })
})

const createEvent = (
    username: string,
    adjustedTime: number,
    difficulty: Difficulty,
): RecentCompletionEvent => ({
    username,
    adjustedTime,
    difficulty,
    completedAtIso: '2026-04-20T12:00:00.000Z',
})
