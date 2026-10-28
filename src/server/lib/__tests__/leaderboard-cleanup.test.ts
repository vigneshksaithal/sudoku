import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import { expect, vi } from 'vitest'
import { cleanGlobalLeaderboardBatch } from '../leaderboard-cleanup'

const test = createDevvitTest()

const seed = async (userId: string, seconds: number, score: number, unranked = false): Promise<void> => {
    await redis.zAdd('leaderboard:global:easy', { member: userId, score })
    await redis.hSet(`solve:global:easy:${userId}`, {
        username: userId, completionTime: String(seconds), hintsUsed: '0', mistakesCount: '0',
        adjustedTime: String(seconds), unranked: String(unranked),
    })
}

test('removes implausible and inconsistent global records but retains plausible records', async () => {
    await seed('fast', 4, 4)
    await seed('mismatch', 100, 80)
    await seed('unranked', 120, 120, true)
    await seed('valid', 200, 200)
    const result = await cleanGlobalLeaderboardBatch(redis, 'easy', 0, 10)
    expect(result).toEqual({ nextOffset: 1, removed: 3, complete: true })
    expect(await redis.zRange('leaderboard:global:easy', 0, -1, { by: 'rank' })).toEqual([{ member: 'valid', score: 200 }])
    expect(await redis.exists('solve:global:easy:fast')).toBe(0)
})

test('continues from the correct offset after removing a row', async () => {
    await seed('valid1', 20, 20)
    await seed('bad', 30, 30, true)
    await seed('valid2', 40, 40)
    const first = await cleanGlobalLeaderboardBatch(redis, 'easy', 0, 2)
    expect(first).toEqual({ nextOffset: 1, removed: 1, complete: false })
    const second = await cleanGlobalLeaderboardBatch(redis, 'easy', first.nextOffset, 2)
    expect(second).toEqual({ nextOffset: 2, removed: 0, complete: true })
})

test('cleans a post leaderboard without changing the global leaderboard', async () => {
    await redis.zAdd('leaderboard:t3_post:easy', { member: 'bad', score: 4 })
    await redis.hSet('solve:t3_post:easy:bad', { completionTime: '4', adjustedTime: '4' })
    await seed('bad', 100, 100)
    const { cleanPostLeaderboardBatch } = await import('../leaderboard-cleanup')
    const result = await cleanPostLeaderboardBatch(redis, 't3_post', 'easy', 0, 10)
    expect(result.removed).toBe(1)
    expect(await redis.zScore('leaderboard:t3_post:easy', 'bad')).toBeUndefined()
    expect(await redis.hGet('solve:t3_post:easy:bad', 'unranked')).toBe('true')
    expect(await redis.zScore('leaderboard:global:easy', 'bad')).toBe(100)
})

test('removes malformed records even when their stored score matches', async () => {
    await redis.zAdd('leaderboard:global:easy', { member: 'malformed', score: 100 })
    await redis.hSet('solve:global:easy:malformed', { completionTime: '100', adjustedTime: '100' })
    const result = await cleanGlobalLeaderboardBatch(redis, 'easy', 0, 10)
    expect(result.removed).toBe(1)
})

test('reports a failed transaction instead of advancing cleanup progress', async () => {
    await seed('bad', 4, 4)
    const originalWatch = redis.watch.bind(redis)
    const watch = vi.spyOn(redis, 'watch')
    watch.mockImplementationOnce(async (...keys) => {
        const transaction = await originalWatch(...keys)
        vi.spyOn(transaction, 'exec').mockResolvedValueOnce([])
        return transaction
    })
    await expect(cleanGlobalLeaderboardBatch(redis, 'easy', 0, 10)).rejects.toThrow()
    watch.mockRestore()
})

test('cleanup cannot remove a new score while it replaces an invalid global record', async () => {
    const { recordSolve } = await import('../leaderboard')
    await seed('player', 100, 400)
    const originalWatch = redis.watch.bind(redis)
    const watch = vi.spyOn(redis, 'watch').mockImplementationOnce(async (...keys) => {
        const transaction = await originalWatch(...keys)
        const execute = transaction.exec.bind(transaction)
        vi.spyOn(transaction, 'exec').mockImplementationOnce(async () => {
            await cleanGlobalLeaderboardBatch(redis, 'easy', 0, 10)
            return execute()
        })
        return transaction
    })
    await recordSolve({ redis, postId: 't3_new', userId: 'player', username: 'player', difficulty: 'easy', completionTime: 200, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
    expect(await redis.zScore('leaderboard:global:easy', 'player')).toBe(200)
    watch.mockRestore()
})

test('a valid new solve replaces an implausible historical global best', async () => {
    const { recordSolve } = await import('../leaderboard')
    await seed('player', 4, 4)
    await recordSolve({ redis, postId: 't3_new', userId: 'player', username: 'player', difficulty: 'easy', completionTime: 200, hintsUsed: 0, mistakesCount: 0, notesUsed: false })
    expect(await redis.zScore('leaderboard:global:easy', 'player')).toBe(200)
})
