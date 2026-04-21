import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { context, redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { app } from '../index'

; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

const test = createDevvitTest({
    subredditName: 'testsub',
    subredditId: 't5_testsub',
    userId: 't2_player',
    username: 'player1',
})

const seedRace = async (postId: string): Promise<void> => {
    await redis.hSet(`post:${postId}:race`, {
        createdAt: '1713571200000',
        title: 'Sudoku Daily Race',
        solverCount: '0',
        'featured:difficulty': 'intermediate',
        'featured:puzzle': '0'.repeat(81),
        'featured:solution': '1'.repeat(81),
        'simple:puzzle': '2'.repeat(81),
        'simple:solution': '2'.repeat(81),
        'easy:puzzle': '3'.repeat(81),
        'easy:solution': '3'.repeat(81),
        'intermediate:puzzle': '0'.repeat(81),
        'intermediate:solution': '1'.repeat(81),
        'expert:puzzle': '4'.repeat(81),
        'expert:solution': '4'.repeat(81),
        scoreThreadId: 't1_scorethread',
    })
    await redis.set(`post:${postId}:score-thread`, 't1_scorethread')
}

test('GET /api/bootstrap returns featured race, profile, leaderboard, and practice puzzles', async () => {
    const postId = context.postId!
    await seedRace(postId)

    const res = await app.request('/api/bootstrap')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.postId).toBe(postId)
    expect(json.data.featuredRace.difficulty).toBe('intermediate')
    expect(json.data.featuredRace.solverCount).toBe(0)
    expect(json.data.playerProfile.currentStreak).toBe(0)
    expect(json.data.leaderboard.entries).toEqual([])
    expect(json.data.practicePuzzles.simple).toHaveLength(81)
})

test('POST /api/complete validates, persists profile progress, and emits a realtime update', async ({ mocks }) => {
    const postId = context.postId!
    await seedRace(postId)

    const res = await app.request('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            board: '1'.repeat(81),
            difficulty: 'intermediate',
            elapsedSeconds: 120,
            hintsUsed: 2,
            validationFailures: 1,
            mode: 'featured',
            completedAtIso: '2026-04-20T12:00:00.000Z',
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toMatchObject({
        status: 'success',
        data: {
            valid: true,
            completion: {
                adjustedTime: 225,
                currentStreak: 1,
                rank: 1,
                previousRank: null,
                dailyGoals: {
                    featuredRace: true,
                    hintFreeAny: false,
                    beatPersonalBest: true,
                },
            },
        },
    })
    expect(await redis.hGet('user:t2_player:sudoku:profile', 'currentStreak')).toBe('1')
    expect(await redis.zCard(`leaderboard:${postId}:daily`)).toBe(1)

    const messages = mocks.realtime.getSentMessagesForChannel(`sudoku_${postId.replace(/[^A-Za-z0-9]/g, '_')}`)
    expect(messages).toHaveLength(1)
})

test('POST /api/complete returns valid false when the submitted board does not match the solution', async () => {
    const postId = context.postId!
    await seedRace(postId)

    const res = await app.request('/api/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            board: '2'.repeat(81),
            difficulty: 'intermediate',
            elapsedSeconds: 120,
            hintsUsed: 0,
            validationFailures: 0,
            mode: 'featured',
            completedAtIso: '2026-04-20T12:00:00.000Z',
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
        status: 'success',
        data: { valid: false },
    })
})

test('GET /api/leaderboard returns ranked entries and recent completions', async () => {
    const postId = context.postId!
    const dayKey = new Date().toISOString().slice(0, 10)
    const completedAtIso = `${dayKey}T12:00:00.000Z`
    await seedRace(postId)
    await redis.zAdd(`leaderboard:${postId}:daily`, { member: 't2_player', score: 225 })
    await redis.hSet(`post:${postId}:completion:t2_player`, {
        username: 'player1',
        adjustedTime: '225',
        elapsedSeconds: '120',
        difficulty: 'intermediate',
    })
    await redis.zAdd(`metrics:${postId}:${dayKey}:recent`, {
        member: JSON.stringify({
            username: 'player1',
            adjustedTime: 225,
            difficulty: 'intermediate',
            completedAtIso,
        }),
        score: Date.parse(completedAtIso),
    })

    const res = await app.request('/api/leaderboard')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.currentUserRank).toBe(1)
    expect(json.data.entries[0]).toMatchObject({
        username: 'player1',
        adjustedTime: 225,
        rank: 1,
    })
    expect(json.data.recentCompletions[0].username).toBe('player1')
})

test('GET /api/preview-state returns top players and preview metadata', async () => {
    const postId = context.postId!
    await seedRace(postId)
    await redis.hSet('user:t2_player:sudoku:profile', {
        currentStreak: '4',
    })
    await redis.zAdd(`leaderboard:${postId}:daily`, { member: 't2_player', score: 225 })
    await redis.hSet(`post:${postId}:completion:t2_player`, {
        username: 'player1',
        adjustedTime: '225',
        elapsedSeconds: '120',
        difficulty: 'intermediate',
    })
    await redis.hSet(`post:${postId}:race`, {
        solverCount: '1',
    })

    const res = await app.request('/api/preview-state')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.featuredRace.solverCount).toBe(1)
    expect(json.data.topPlayers[0].username).toBe('player1')
    expect(json.data.playerProfile.currentStreak).toBe(4)
})

test('POST /api/comment-score replies to the sticky score thread when no note is provided', async () => {
    const postId = context.postId!
    await seedRace(postId)

    vi.spyOn(reddit, 'submitComment').mockResolvedValue({ id: 't1_reply' } as never)

    const res = await app.request('/api/comment-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            difficulty: 'intermediate',
            mode: 'featured',
            elapsedSeconds: 120,
            adjustedTime: 225,
            hintsUsed: 2,
            validationFailures: 1,
            rank: 1,
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
        status: 'success',
        data: { commentId: 't1_reply', target: 'score-thread' },
    })
    expect(reddit.submitComment).toHaveBeenCalledWith(expect.objectContaining({
        id: 't1_scorethread',
        runAs: 'USER',
    }))
})

test('POST /api/comment-score posts top-level when a note is provided', async () => {
    const postId = context.postId!
    await seedRace(postId)

    vi.spyOn(reddit, 'submitComment').mockResolvedValue({ id: 't1_top' } as never)

    const res = await app.request('/api/comment-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            difficulty: 'intermediate',
            mode: 'featured',
            elapsedSeconds: 120,
            adjustedTime: 225,
            hintsUsed: 2,
            validationFailures: 1,
            rank: 1,
            note: 'Finally broke my lunch-break record.',
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
        status: 'success',
        data: { commentId: 't1_top', target: 'post' },
    })
    expect(reddit.submitComment).toHaveBeenCalledWith(expect.objectContaining({
        id: postId,
        runAs: 'USER',
        text: expect.stringContaining('Finally broke my lunch-break record.'),
    }))
})

test('POST /api/comment-score returns 403 when no Reddit username is available', async () => {
    const postId = context.postId!
    await seedRace(postId)

    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue(undefined)

    const res = await app.request('/api/comment-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            difficulty: 'intermediate',
            mode: 'featured',
            elapsedSeconds: 120,
            adjustedTime: 225,
            hintsUsed: 2,
            validationFailures: 1,
        }),
    })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.status).toBe('error')
})

test('POST /api/subscribe subscribes the current user to the subreddit', async () => {
    vi.spyOn(reddit, 'subscribeToCurrentSubreddit').mockResolvedValue(undefined)

    const res = await app.request('/api/subscribe', {
        method: 'POST',
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
        status: 'success',
        data: { subscribed: true },
    })
    expect(reddit.subscribeToCurrentSubreddit).toHaveBeenCalledOnce()
})
