import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { createPost } from '../post'

const test = createDevvitTest()

const DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

test('createPost stores race metadata, seeds a sticky score thread, and submits the post', async ({ subredditName }) => {
    const distinguish = vi.fn().mockResolvedValue(undefined)

    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc123' } as never)
    vi.spyOn(reddit, 'submitComment').mockResolvedValue({
        id: 't1_scorethread',
        distinguish,
    } as never)

    const result = await createPost()

    expect(reddit.submitCustomPost).toHaveBeenCalledWith(expect.objectContaining({
        subredditName,
        entry: 'default',
    }))
    expect(result).toEqual({ id: 't3_abc123' })
    expect(reddit.submitComment).toHaveBeenCalledWith(expect.objectContaining({
        id: 't3_abc123',
        runAs: 'APP',
    }))
    expect(distinguish).toHaveBeenCalledWith(true)

    const postId = 't3_abc123'
    const createdAt = await redis.hGet(`post:${postId}:race`, 'createdAt')
    expect(Number(createdAt)).toBeGreaterThan(0)
    expect(await redis.hGet(`post:${postId}:race`, 'featured:difficulty')).toBe('intermediate')
    expect(await redis.hGet(`post:${postId}:race`, 'scoreThreadId')).toBe('t1_scorethread')
    expect(await redis.get(`post:${postId}:score-thread`)).toBe('t1_scorethread')

    for (const d of DIFFICULTIES) {
        const puzzle = await redis.hGet(`post:${postId}:race`, `${d}:puzzle`)
        const solution = await redis.hGet(`post:${postId}:race`, `${d}:solution`)

        expect(puzzle).toBeDefined()
        expect(solution).toBeDefined()
        expect(puzzle).toHaveLength(81)
        expect(solution).toHaveLength(81)
        expect(puzzle).toMatch(/^[0-9]{81}$/)
        expect(solution).toMatch(/^[0-9]{81}$/)
        expect(solution).not.toContain('0')
        expect(puzzle).toContain('0')
    }
}, 60_000)

test('createPost propagates Reddit API errors', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue(new Error('Rate limited'))

    await expect(createPost()).rejects.toThrow('Rate limited')
})
