import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import * as stickyCommentModule from '../lib/sticky-comment'
import { createPost } from '../post'

const test = createDevvitTest()

const DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

test('createPost generates 4 puzzles, stores in Redis, and submits post', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc123' } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc0' })

    const result = await createPost()

    expect(reddit.submitCustomPost).toHaveBeenCalledWith({
        subredditName,
        title: expect.stringMatching(/^Sudoku #\d{2}-\d{2}-\d{4}$/),
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

test('createPost calls createStickyComment with correct args after storing puzzle data', async ({ subredditName: _subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_sticky1' } as never)
    const spy = vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc1' })

    await createPost()

    expect(spy).toHaveBeenCalledWith(
        { reddit, redis },
        't3_sticky1',
        '🏆 **Score Thread** — Share your solve time! Use the "Comment My Score" button after completing the puzzle.'
    )
}, 60_000)

test('createPost still returns post when createStickyComment fails', async ({ subredditName: _subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_sticky2' } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: false })

    const result = await createPost()

    expect(result).toEqual({ id: 't3_sticky2' })
}, 60_000)

test('createPost propagates Reddit API errors', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue(new Error('Rate limited'))

    await expect(createPost()).rejects.toThrow('Rate limited')
})
