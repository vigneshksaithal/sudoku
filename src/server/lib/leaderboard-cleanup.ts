import type { RedisClient } from '@devvit/redis'
import type { ValidDifficulty } from './leaderboard'

// Historical global records do not identify their puzzle, so use a conservative floor.
const HISTORICAL_MIN_SECONDS = 10

export const cleanGlobalLeaderboardBatch = async (
    redis: RedisClient, difficulty: ValidDifficulty, offset: number, limit: number
): Promise<CleanupResult> => cleanLeaderboardBatch(redis, 'global', difficulty, offset, limit)

export const cleanPostLeaderboardBatch = async (
    redis: RedisClient, postId: string, difficulty: ValidDifficulty, offset: number, limit: number
): Promise<CleanupResult> => cleanLeaderboardBatch(redis, postId, difficulty, offset, limit)

type CleanupResult = { nextOffset: number; removed: number; complete: boolean }

const cleanLeaderboardBatch = async (
    redis: RedisClient, scope: string, difficulty: ValidDifficulty, offset: number, limit: number
): Promise<CleanupResult> => {
    const key = `leaderboard:${scope}:${difficulty}`
    const members = await redis.zRange(key, offset, offset + limit - 1, { by: 'rank' })
    let removed = 0
    for (const member of members) {
        if (await removeInvalidRecord(redis, key, `solve:${scope}:${difficulty}:${member.member}`, member.member, scope === 'global')) removed++
    }
    return { nextOffset: offset + members.length - removed, removed, complete: members.length < limit }
}

const removeInvalidRecord = async (
    redis: RedisClient, key: string, solveKey: string, userId: string, removeHash: boolean
): Promise<boolean> => {
    const transaction = await redis.watch(key, solveKey)
    const score = await redis.zScore(key, userId)
    const record = await redis.hGetAll(solveKey)
    if (score === undefined || !isInvalidHistoricalRecord(record, score)) {
        await transaction.multi()
        await transaction.discard()
        return false
    }
    await transaction.multi()
    await transaction.zRem(key, [userId])
    if (removeHash) await transaction.del(solveKey)
    else await transaction.hSet(solveKey, { unranked: 'true' })
    const result = await transaction.exec()
    if (result.length !== 2 || result[0] !== 1) throw new Error('Leaderboard changed during cleanup; retry')
    return true
}

export const isInvalidHistoricalRecord = (record: Record<string, string>, score: number): boolean => {
    const time = parseNonNegativeInteger(record['completionTime'])
    const hints = parseNonNegativeInteger(record['hintsUsed'])
    const mistakes = parseNonNegativeInteger(record['mistakesCount'])
    const adjusted = parseNonNegativeInteger(record['adjustedTime'])
    if (!record['username'] || time === null || hints === null || mistakes === null || adjusted === null) return true
    return time < HISTORICAL_MIN_SECONDS || record['unranked'] === 'true' || adjusted !== score || time + hints * 30 !== score
}

const parseNonNegativeInteger = (value: string | undefined): number | null => {
    if (value === undefined || !/^\d+$/.test(value)) return null
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
}
