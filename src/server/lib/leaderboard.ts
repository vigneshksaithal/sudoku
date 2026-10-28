import type { RedisClient } from '@devvit/redis'
import { DIFFICULTIES } from './sudoku'
import { isInvalidHistoricalRecord } from './leaderboard-cleanup'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidDifficulty = (typeof DIFFICULTIES)[number]

export type LeaderboardEntry = {
    rank: number | null
    username: string
    completionTime: number
    hintsUsed: number
    mistakesCount: number
    adjustedTime: number
    notesUsed: boolean | undefined
    unranked: boolean
}

export type LeaderboardResponse = {
    entries: LeaderboardEntry[]
    userEntry: LeaderboardEntry | null
}

export type SolveResponse = {
    postRank: number | null
    globalRank: number | null
    adjustedTime: number
}

// ─── Validation ───────────────────────────────────────────────────────────────

export const isValidDifficulty = (d: unknown): d is ValidDifficulty =>
    typeof d === 'string' && (DIFFICULTIES as readonly string[]).includes(d)

const isNonNegativeInteger = (value: unknown): value is number =>
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0

/** Validate and parse a solve submission body. Returns parsed fields or an error string. */
export const validateSolveInput = (
    body: unknown
): { difficulty: ValidDifficulty; completionTime: number; hintsUsed: number; mistakesCount: number; notesUsed: boolean; unranked: boolean } | string => {
    if (!body || typeof body !== 'object') return 'Invalid request body'

    const obj = body as Record<string, unknown>
    const { difficulty, completionTime, hintsUsed, mistakesCount, notesUsed, unranked } = obj

    if (!isValidDifficulty(difficulty)) return 'Invalid difficulty'
    if (!isNonNegativeInteger(completionTime)) return 'Invalid completionTime: must be a non-negative integer'
    if (!isNonNegativeInteger(hintsUsed)) return 'Invalid hintsUsed: must be a non-negative integer'
    if (!isNonNegativeInteger(mistakesCount)) return 'Invalid mistakesCount: must be a non-negative integer'
    if (!Number.isSafeInteger(completionTime + hintsUsed * 30)) return 'Invalid adjusted time: exceeds safe integer range'
    if (typeof notesUsed !== 'boolean') return 'Invalid notesUsed: must be a boolean'

    let resolvedUnranked: boolean
    if (unranked === undefined) {
        resolvedUnranked = false
    } else if (typeof unranked === 'boolean') {
        resolvedUnranked = unranked
    } else {
        return 'Invalid unranked: must be a boolean'
    }

    return { difficulty, completionTime, hintsUsed, mistakesCount, notesUsed, unranked: resolvedUnranked }
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

/** Compute adjusted time score: completionTime + hintsUsed * 30 */
export const computeAdjustedTime = (completionTime: number, hintsUsed: number): number =>
    completionTime + hintsUsed * 30

/** Build a cache key for a leaderboard response that may include a viewer's own rank. */
export const buildLeaderboardCacheKey = (leaderboardKey: string, userId?: string): string =>
    `${leaderboardKey}:viewer:${userId ?? 'anonymous'}`

// ─── Redis Operations ─────────────────────────────────────────────────────────

const parseUnranked = (raw: string | undefined): boolean => raw === 'true'

const parseSolveRecord = (
    data: Record<string, string>,
    rank: number | null
): LeaderboardEntry | null => {
    const { username, completionTime, hintsUsed, mistakesCount, adjustedTime, notesUsed: notesUsedRaw, unranked: unrankedRaw } = data
    if (!username || completionTime === undefined || hintsUsed === undefined || mistakesCount === undefined || adjustedTime === undefined) {
        return null
    }
    const notesUsed = notesUsedRaw === 'true' ? true
        : notesUsedRaw === 'false' ? false
            : undefined
    const unranked = parseUnranked(unrankedRaw)
    return {
        rank,
        username,
        completionTime: parseInt(completionTime, 10),
        hintsUsed: parseInt(hintsUsed, 10),
        mistakesCount: parseInt(mistakesCount, 10),
        adjustedTime: parseInt(adjustedTime, 10),
        notesUsed,
        unranked,
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
    notesUsed: boolean
    unranked?: boolean
}): Promise<{ postRank: number | null; globalRank: number | null; adjustedTime: number } | string> => {
    const { redis, postId, userId, username, difficulty, completionTime, hintsUsed, mistakesCount, notesUsed, unranked = false } = params

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
        notesUsed: String(notesUsed),
        unranked: String(unranked),
    })

    const record = {
        username,
        completionTime: String(completionTime),
        hintsUsed: String(hintsUsed),
        mistakesCount: String(mistakesCount),
        adjustedTime: String(adjustedTime),
        notesUsed: String(notesUsed),
        unranked: String(unranked),
    }
    if (!unranked) await redis.zAdd(`leaderboard:${postId}:${difficulty}`, { member: userId, score: adjustedTime })
    const globalLeaderboardKey = `leaderboard:global:${difficulty}`
    await updateGlobalRecord(redis, globalLeaderboardKey, `solve:global:${difficulty}:${userId}`, userId, adjustedTime, unranked, record)
    if (unranked) return { postRank: null, globalRank: null, adjustedTime }
    const postLeaderboardKey = `leaderboard:${postId}:${difficulty}`

    const postRankRaw = await redis.zRank(postLeaderboardKey, userId)
    const globalRankRaw = await redis.zRank(globalLeaderboardKey, userId)

    const postRank = (postRankRaw ?? 0) + 1
    const globalRank = (globalRankRaw ?? 0) + 1

    return { postRank, globalRank, adjustedTime }
}

const updateGlobalRecord = async (
    redis: RedisClient, leaderboardKey: string, solveKey: string, userId: string,
    score: number, unranked: boolean, record: Record<string, string>
): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const tx = await redis.watch(leaderboardKey, solveKey)
        const existing = await redis.zScore(leaderboardKey, userId)
        const oldRecord = existing !== undefined && !unranked ? await redis.hGetAll(solveKey) : null
        const keepExisting = existing !== undefined && (unranked || (existing <= score && oldRecord !== null && !isInvalidHistoricalRecord(oldRecord, existing)))
        if (keepExisting) {
            await tx.multi()
            await tx.discard()
            return
        }
        await tx.multi()
        if (!unranked) await tx.zAdd(leaderboardKey, { member: userId, score })
        await tx.hSet(solveKey, record)
        const result = await tx.exec()
        if (result.length === (unranked ? 1 : 2)) return
    }
    throw new Error('Global leaderboard changed during score submission')
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
    if (userRankRaw === undefined) {
        // Fallback: check if user has an unranked solve hash
        const userSolveKey = `${solveKeyPrefix}:${userId}`
        const userData = await redis.hGetAll(userSolveKey)
        const unrankedEntry = parseSolveRecord(userData, null)
        if (unrankedEntry && unrankedEntry.unranked) {
            return { entries, userEntry: unrankedEntry }
        }
        return { entries, userEntry: null }
    }

    const userSolveKey = `${solveKeyPrefix}:${userId}`
    const userData = await redis.hGetAll(userSolveKey)
    const userEntry = parseSolveRecord(userData, userRankRaw + 1)

    return { entries, userEntry }
}
