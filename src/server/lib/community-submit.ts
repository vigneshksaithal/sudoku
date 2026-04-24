import type { RedisClient } from '@devvit/redis'
import type { Difficulty } from './sudoku'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CooldownResult =
    | { allowed: true }
    | { allowed: false; remainingSeconds: number }

export type SubmissionHistoryEntry = {
    postId: string
    difficulty: Difficulty
    createdAt: number
    solveCount: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const COOLDOWN_SECONDS = 900 // 15 minutes

// ─── Redis Key Helpers ────────────────────────────────────────────────────────

const cooldownKey = (userId: string): string => `cooldown:${userId}`
const submissionsKey = (userId: string): string => `submissions:${userId}`
const puzzleKey = (postId: string): string => `puzzle:${postId}`

// ─── Cooldown Operations ──────────────────────────────────────────────────────

/** Check if user is within submission cooldown. */
export const checkCooldown = async (
    redis: RedisClient,
    userId: string
): Promise<CooldownResult> => {
    // expireTime returns the absolute Unix timestamp (seconds) when the key expires,
    // or 0 if the key has no TTL / does not exist.
    const expiresAt = await redis.expireTime(cooldownKey(userId))
    if (expiresAt <= 0) return { allowed: true }
    const remainingSeconds = Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
    if (remainingSeconds <= 0) return { allowed: true }
    return { allowed: false, remainingSeconds }
}

/** Record submission timestamp for cooldown tracking. */
export const setCooldown = async (
    redis: RedisClient,
    userId: string
): Promise<void> => {
    const key = cooldownKey(userId)
    await redis.set(key, String(Date.now()))
    await redis.expire(key, COOLDOWN_SECONDS)
}

// ─── Submission History Operations ───────────────────────────────────────────

/** Add post to user's submission history sorted set. */
export const addToSubmissionHistory = async (
    redis: RedisClient,
    userId: string,
    postId: string,
    timestamp: number
): Promise<void> => {
    await redis.zAdd(submissionsKey(userId), { member: postId, score: timestamp })
}

/** Get user's submission history with puzzle metadata. */
export const getSubmissionHistory = async (
    redis: RedisClient,
    userId: string
): Promise<SubmissionHistoryEntry[]> => {
    const members = await redis.zRange(submissionsKey(userId), 0, -1, { by: 'rank' })
    if (members.length === 0) return []

    const entries: SubmissionHistoryEntry[] = []
    for (const { member: postId } of members) {
        const data = await redis.hGetAll(puzzleKey(postId))
        const entry = parsePuzzleHashToEntry(postId, data)
        if (entry !== null) entries.push(entry)
    }
    return entries
}

// ─── Solve Count Operations ───────────────────────────────────────────────────

/** Increment solve count for a community puzzle. Returns the new count. */
export const incrementSolveCount = async (
    redis: RedisClient,
    postId: string
): Promise<number> => {
    return redis.hIncrBy(puzzleKey(postId), 'solveCount', 1)
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/** Parse a puzzle hash record into a SubmissionHistoryEntry, or null if required fields are missing. */
const parsePuzzleHashToEntry = (
    postId: string,
    data: Record<string, string>
): SubmissionHistoryEntry | null => {
    const { difficulty, createdAt, solveCount } = data
    if (difficulty === undefined || createdAt === undefined) return null
    return {
        postId,
        difficulty: difficulty as Difficulty,
        createdAt: parseInt(createdAt, 10),
        solveCount: solveCount !== undefined ? parseInt(solveCount, 10) : 0,
    }
}
