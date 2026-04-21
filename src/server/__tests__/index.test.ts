import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit, settings } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { app } from '../index'

const test = createDevvitTest()

test('POST /internal/on-app-install returns navigateTo on success', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost' } as never)
    vi.spyOn(reddit, 'submitComment').mockResolvedValue({
        id: 't1_install',
        distinguish: vi.fn().mockResolvedValue(undefined),
    } as never)

    const res = await app.request('/internal/on-app-install', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.navigateTo).toBe(
        `https://reddit.com/r/${subredditName}/comments/t3_newpost`
    )
}, 60_000)

test('POST /internal/menu/post-create returns navigateTo on success', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc' } as never)
    vi.spyOn(reddit, 'submitComment').mockResolvedValue({
        id: 't1_menu',
        distinguish: vi.fn().mockResolvedValue(undefined),
    } as never)

    const res = await app.request('/internal/menu/post-create', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.navigateTo).toBe(
        `https://reddit.com/r/${subredditName}/comments/t3_abc`
    )
}, 60_000)

test('POST /internal/on-app-install returns error on failure', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue(new Error('API down'))

    const res = await app.request('/internal/on-app-install', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ status: 'error', message: 'API down' })
})

test('POST /internal/on-app-install handles non-Error throws', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue('string error')

    const res = await app.request('/internal/on-app-install', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ status: 'error', message: 'Failed to create post' })
})

// --- Triggers and schedulers ---

test('POST /internal/on-post-create seeds a sticky score thread for race posts', async () => {
    await redis.hSet('post:t3_seeded:race', {
        createdAt: '1713571200000',
        'featured:difficulty': 'intermediate',
    })
    const distinguish = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(reddit, 'submitComment').mockResolvedValue({
        id: 't1_sticky',
        distinguish,
    } as never)

    const res = await app.request('/internal/on-post-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            post: { id: 't3_seeded' },
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ status: 'ok' })
    expect(reddit.submitComment).toHaveBeenCalledWith(expect.objectContaining({
        id: 't3_seeded',
    }))
    expect(distinguish).toHaveBeenCalledWith(true)
    expect(await redis.get('post:t3_seeded:score-thread')).toBe('t1_sticky')
})

test('POST /internal/cron/daily-post creates a post when the configured UTC hour matches', async () => {
    vi.spyOn(settings, 'get').mockImplementation(async (key: string) => {
        if (key === 'dailyPostHourUtc') return 8
        return undefined
    })
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_daily' } as never)
    vi.spyOn(reddit, 'submitComment').mockResolvedValue({
        id: 't1_daily',
        distinguish: vi.fn().mockResolvedValue(undefined),
    } as never)

    const res = await app.request('/internal/cron/daily-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: { nowIso: '2026-04-20T08:00:00.000Z' },
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ status: 'ok' })
})

test('POST /internal/cron/weekly-roundup publishes a roundup and resets weekly standings', async ({ subredditName }) => {
    vi.spyOn(settings, 'get').mockImplementation(async (key: string) => {
        if (key === 'weeklyRoundupDay') return 'mon'
        if (key === 'dailyPostHourUtc') return 8
        if (key === 'winnerFlairEnabled') return true
        return undefined
    })

    await redis.hSet('user:t2_player:sudoku:profile', {
        username: 'player1',
        currentStreak: '9',
        weeklyBestImprovement: '54',
    })
    await redis.zAdd(`leaderboard:${subredditName}:weekly`, { member: 't2_player', score: 1_000_000 - 210 })

    vi.spyOn(reddit, 'submitPost').mockResolvedValue({ id: 't3_roundup' } as never)
    vi.spyOn(reddit, 'setUserFlair').mockResolvedValue(undefined)

    const res = await app.request('/internal/cron/weekly-roundup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            data: { nowIso: '2026-04-20T08:15:00.000Z' },
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ status: 'ok' })
    expect(reddit.submitPost).toHaveBeenCalledWith(expect.objectContaining({
        subredditName,
        title: expect.stringContaining('Weekly Roundup'),
        text: expect.stringContaining('player1'),
    }))
    expect(reddit.setUserFlair).toHaveBeenCalledWith(expect.objectContaining({
        subredditName,
        username: 'player1',
    }))
    expect(await redis.zCard(`leaderboard:${subredditName}:weekly`)).toBe(0)
})
