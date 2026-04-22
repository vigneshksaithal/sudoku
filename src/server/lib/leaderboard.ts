import type { RedisClient } from '@devvit/redis'
import { DIFFICULTIES } from './sudoku'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidDifficulty = (typeof DIFFICULTIES)[number]

export type LeaderboardEntry = {
    rank: number
    username: string
    completionTime: number
    hintsUsed: number
    mistakesCount: number
    adjustedTime: number
}

export type LeaderboardResponse = {
    entries: LeaderboardEntry[]
    userEntry: LeaderboardEntry | null
}

export type SolveResponse = {
    postRank: number
    globalRank: number
    adjustedTime: number
}

// ─── Validation ───────────────────────────────────────────────────────────────

export const isValidDifficulty = (d: unknown): d is ValidDifficulty =>
    typeof d === 'string' && (DIFFICULTIES as readonly string[]).includes(d)

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0

/** Validate and parse a solve submission body. Returns parsed fields or an error string. */
export const validateSolveInput = (
    body: unknown
): { difficulty: ValidDifficulty; completionTime: number; hintsUsed: number; mistakesCount: number } | string => {
    if (!body || typeof body !== 'object') return 'Invalid request body'

    const obj = body as Record<string, unknown>
    const { difficulty, completionTime, hintsUsed, mistakesCount } = obj

    if (!isValidDifficulty(difficulty)) return 'Invalid difficulty'
    if (!isNonNegativeInteger(completionTime)) return 'Invalid completionTime: must be a non-negative integer'
    if (!isNonNegativeInteger(hintsUsed)) return 'Invalid hintsUsed: must be a non-negative integer'
    if (!isNonNegativeInteger(mistakesCount)) return 'Invalid mistakesCount: must be a non-negative integer'

    return { difficulty, completionTime, hintsUsed, mistakesCount }
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

/** Compute adjusted time score: completionTime + hintsUsed * 30 */
export const computeAdjustedTime = (completionTime: number, hintsUsed: number): number =>
    completionTime + hintsUsed * 30

// ─── Redis Operations ─────────────────────────────────────────────────────────

const parseSolveRecord = (
    data: Record<string, string>,
    rank: number
): LeaderboardEntry | null => {
    const { username, completionTime, hintsUsed, mistakesCount, adjustedTime } = data
    if (!username || completionTime === undefined || hintsUsed === undefined || mistakesCount === undefined || adjustedTime === undefined) {
        return null
    }
    return {
        rank,
        username,
        completionTime: parseInt(completionTime, 10),
        hintsUsed: parseInt(hintsUsed, 10),
        mistakesCount: parseInt(mistakesCount, 10),
        adjustedTime: parseInt(adjustedTime, 10),
    }
}

/** Record a solve to Redis. Returns post and global ranks, or an error string. */
export const recordSolve = async (params: {
    redis: RedisClient
    postId: string
    userId: string
    username: string
    difficulty: ValidDifficulty
    completionTime: number
    hintsUsed: number
    mistakesCount: number
}): Promise<{ postRank: number; globalRank: number; adjustedTime: number } | string> => {
    const { redis, postId, userId, username, difficulty, completionTime, hintsUsed, mistakesCount } = params

    const solveKey = `solve:${postId}:${difficulty}:${userId}`
    const isDuplicate = await redis.exists(solveKey)
    if (isDuplicate) return 'Already solved'

    const adjustedTime = computeAdjustedTime(completionTime, hintsUsed)

    await redis.hSet(solveKey, {
        username,
        completionTime: String(completionTime),
        hintsUsed: String(hintsUsed),
        mistakesCount: String(mistakesCount),
        adjustedTime: String(adjustedTime),
    })

    const postLeaderboardKey = `leaderboard:${postId}:${difficulty}`
    await redis.zAdd(postLeaderboardKey, { member: userId, score: adjustedTime })

    const globalLeaderboardKey = `leaderboard:global:${difficulty}`
    const existingGlobalScore = await redis.zScore(globalLeaderboardKey, userId)
    const shouldUpdateGlobal = existingGlobalScore === undefined || adjustedTime < existingGlobalScore

    if (shouldUpdateGlobal) {
        await redis.zAdd(globalLeaderboardKey, { member: userId, score: adjustedTime })
        const globalSolveKey = `solve:global:${difficulty}:${userId}`
        await redis.hSet(globalSolveKey, {
            username,
            completionTime: String(completionTime),
            hintsUsed: String(hintsUsed),
            mistakesCount: String(mistakesCount),
            adjustedTime: String(adjustedTime),
        })
    }

    const postRankRaw = await redis.zRank(postLeaderboardKey, userId)
    const globalRankRaw = await redis.zRank(globalLeaderboardKey, userId)

    const postRank = (postRankRaw ?? 0) + 1
    const globalRank = (globalRankRaw ?? 0) + 1

    return { postRank, globalRank, adjustedTime }
}

/** Fetch top-N leaderboard entries plus optional user entry if outside top N. */
export const getLeaderboard = async (params: {
    redis: RedisClient
    key: string
    solveKeyPrefix: string
    userId?: string
    limit?: number
}): Promise<LeaderboardResponse> => {
    const { redis, key, solveKeyPrefix, userId, limit = 10 } = params

    const topMembers = await redis.zRange(key, 0, limit - 1, { by: 'rank' })

    const entries: LeaderboardEntry[] = []
    for (let i = 0; i < topMembers.length; i++) {
        const member = topMembers[i]
        if (!member) continue
        const solveKey = `${solveKeyPrefix}:${member.member}`
        const data = await redis.hGetAll(solveKey)
        const entry = parseSolveRecord(data, i + 1)
        if (entry) entries.push(entry)
    }

    if (!userId) return { entries, userEntry: null }

    const isInTopN = topMembers.some((m) => m.member === userId)
    if (isInTopN) return { entries, userEntry: null }

    const userRankRaw = await redis.zRank(key, userId)
    if (userRankRaw === undefined) return { entries, userEntry: null }

    const userSolveKey = `${solveKeyPrefix}:${userId}`
    const userData = await redis.hGetAll(userSolveKey)
    const userEntry = parseSolveRecord(userData, userRankRaw + 1)

    return { entries, userEntry }
}
