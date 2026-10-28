import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import { reddit } from '@devvit/reddit'
import { expect, vi } from 'vitest'
import { app } from '../index'

const test = createDevvitTest()

test('moderator cleanup traverses the global boards and removes invalid entries', async () => {
    vi.spyOn(reddit, 'getCurrentUser').mockResolvedValue({ getModPermissionsForSubreddit: async () => ['all'] } as never)
    await redis.zAdd('leaderboard:global:simple', { member: 'bad', score: 4 })
    await redis.hSet('solve:global:simple:bad', { completionTime: '4', adjustedTime: '4' })
    for (let i = 0; i < 4; i++) {
        const res = await app.request('/internal/menu/clean-leaderboards', { method: 'POST' })
        expect(res.status).toBe(200)
    }
    expect(await redis.zScore('leaderboard:global:simple', 'bad')).toBeUndefined()
    expect(await redis.exists('leaderboard-cleanup:global:progress')).toBe(0)
})

test('post cleanup requires a post context', async () => {
    vi.spyOn(reddit, 'getCurrentUser').mockResolvedValue({ getModPermissionsForSubreddit: async () => ['all'] } as never)
    const res = await app.request('/internal/menu/clean-post-leaderboard', { method: 'POST' })
    expect(res.status).toBe(400)
})

test('rejects a non-moderator attempting cleanup', async () => {
    vi.spyOn(reddit, 'getCurrentUser').mockResolvedValue({ getModPermissionsForSubreddit: async () => [] } as never)
    await redis.zAdd('leaderboard:global:simple', { member: 'bad', score: 4 })
    const res = await app.request('/internal/menu/clean-leaderboards', { method: 'POST' })
    expect(res.status).toBe(403)
    expect(await redis.zScore('leaderboard:global:simple', 'bad')).toBe(4)
})
