import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/web/server'
import { expect } from 'vitest'

const test = createDevvitTest()

// These tests demonstrate the in-memory Redis provided by @devvit/test.
// Use this pattern when building features that store/retrieve data.

test('string get/set works with real in-memory Redis', async () => {
    await redis.set('greeting', 'hello world')
    const value = await redis.get('greeting')
    expect(value).toBe('hello world')
})

test('each test gets isolated Redis state', async () => {
    // This key was set in the previous test, but isolation means it's gone
    const value = await redis.get('greeting')
    expect(value).toBeUndefined()
})

test('incrBy tracks counters', async () => {
    await redis.incrBy('score', 5)
    await redis.incrBy('score', 3)
    const score = await redis.get('score')
    expect(score).toBe('8')
})

test('hash operations work end-to-end', async () => {
    await redis.hSet('user:t2_abc:stats', { solved: '5', bestTime: '120' })

    const stats = await redis.hGetAll('user:t2_abc:stats')
    expect(stats).toEqual({ solved: '5', bestTime: '120' })

    const solved = await redis.hGet('user:t2_abc:stats', 'solved')
    expect(solved).toBe('5')
})

test('sorted sets support leaderboard patterns', async () => {
    await redis.zAdd('leaderboard:wins', { member: 'alice', score: 100 })
    await redis.zAdd('leaderboard:wins', { member: 'bob', score: 200 })
    await redis.zAdd('leaderboard:wins', { member: 'charlie', score: 150 })

    const top = await redis.zRange('leaderboard:wins', 0, 2, { by: 'rank', reverse: true })
    expect(top.map((e) => e.member)).toEqual(['bob', 'charlie', 'alice'])
})

test('transactions commit atomically', async () => {
    await redis.set('txn', '0')
    const txn = await redis.watch('txn')
    await txn.multi()
    await txn.incrBy('txn', 4)
    await txn.incrBy('txn', 1)
    const results = await txn.exec()

    expect(results).toStrictEqual([4, 5])
    expect(await redis.get('txn')).toBe('5')
})
