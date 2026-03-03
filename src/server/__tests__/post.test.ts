import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { createPost } from '../post'

const test = createDevvitTest()

const DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

test('createPost generates 4 puzzles, stores in Redis, and submits post', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc123' } as never)

    const result = await createPost()

    expect(reddit.submitCustomPost).toHaveBeenCalledWith({
        subredditName,
        title: 'Sudoku',
        entry: 'default',
    })
    expect(result).toEqual({ id: 't3_abc123' })

    const postId = 't3_abc123'
    const createdAt = await redis.hGet(`puzzle:${postId}`, 'createdAt')
    expect(Number(createdAt)).toBeGreaterThan(0)

    for (const d of DIFFICULTIES) {
        const puzzle = await redis.hGet(`puzzle:${postId}`, `${d}:puzzle`)
        const solution = await redis.hGet(`puzzle:${postId}`, `${d}:solution`)

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
