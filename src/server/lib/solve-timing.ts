import type { RedisClient } from '@devvit/redis'
import type { ValidDifficulty } from './leaderboard'

const TIMING_TTL_SECONDS = 7 * 24 * 60 * 60
/**
 * Minimum plausible seconds per empty cell for a ranked solve, by difficulty.
 * Singles-only tiers can legitimately be filled much faster than tiers that
 * need subsets, wings or chains, so one flat rate either caps strong solvers on
 * easy puzzles or lets automated solves through on hard ones.
 */
export const SECONDS_PER_EMPTY_CELL: Record<ValidDifficulty, number> = {
    simple: 1,
    easy: 1,
    intermediate: 1.5,
    expert: 2,
}
const MINIMUM_RANKED_SECONDS = 10
const TIMER_GRACE_SECONDS = 5

export const timingKey = (postId: string, difficulty: ValidDifficulty, userId: string): string =>
    `solve-start:${postId}:${difficulty}:${userId}`

export const startTiming = async (redis: RedisClient, key: string, now: number): Promise<void> => {
    await redis.del(key)
    await redis.hSet(key, { startedAt: String(now), pausedMs: '0' })
    await redis.expire(key, TIMING_TTL_SECONDS)
}

export const changeTimingPause = async (
    redis: RedisClient, key: string, action: 'pause' | 'resume', now: number
): Promise<boolean> => {
    const timing = await redis.hGetAll(key)
    const startedAt = parseTimestamp(timing['startedAt'])
    const pausedMs = parseTimestamp(timing['pausedMs'])
    if (startedAt === null || pausedMs === null || now < startedAt) return false
    if (action === 'pause') {
        if (timing['pausedAt']) return false
        await redis.hSet(key, { pausedAt: String(now) })
        return true
    }
    const pausedAt = parseTimestamp(timing['pausedAt'])
    if (pausedAt === null || now < pausedAt) return false
    await redis.hSet(key, { pausedMs: String(pausedMs + now - pausedAt), pausedAt: '' })
    return true
}

const parseTimestamp = (value: string | undefined): number | null => {
    if (value === undefined || !/^\d+$/.test(value)) return null
    const number = Number(value)
    return Number.isSafeInteger(number) ? number : null
}

export const assessTiming = (
    timing: Record<string, string>, puzzle: string, difficulty: ValidDifficulty, clientSeconds: number, now: number
): { completionTime: number; unranked: boolean } => {
    const startedAt = parseTimestamp(timing['startedAt'])
    const pausedMs = parseTimestamp(timing['pausedMs'])
    if (startedAt === null || pausedMs === null || timing['pausedAt'] || now < startedAt + pausedMs) {
        return { completionTime: clientSeconds, unranked: true }
    }
    const completionTime = Math.floor((now - startedAt - pausedMs) / 1000)
    const minimum = minimumRankedSeconds(puzzle, difficulty)
    const grace = TIMER_GRACE_SECONDS + Math.ceil(completionTime * 0.05)
    const unranked = completionTime < minimum || clientSeconds < completionTime - grace
    return { completionTime, unranked }
}

export const minimumRankedSeconds = (puzzle: string, difficulty: ValidDifficulty): number => {
    const emptyCells = [...puzzle].filter((cell) => cell === '0').length
    return Math.max(MINIMUM_RANKED_SECONDS, Math.ceil(emptyCells * SECONDS_PER_EMPTY_CELL[difficulty]))
}
