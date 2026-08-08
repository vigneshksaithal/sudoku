import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import * as stickyCommentModule from '../lib/sticky-comment'
import { createPost } from '../post'

const PINNED_POST_KEY = 'pinnedPostId'

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
        flairId: '3f535fd8-439f-11f1-a102-123c67b47fa1',
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

test('createPost stickies the new post to slot 1', async () => {
    const mockSticky = vi.fn().mockResolvedValue(undefined)
    const mockFaqSticky = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost' } as never)
    vi.spyOn(reddit, 'getPostById')
        .mockResolvedValueOnce({ id: 't3_newpost', sticky: mockSticky } as never)
        .mockResolvedValueOnce({ id: 't3_1kcughf', sticky: mockFaqSticky } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc2' })

    await createPost()

    expect(mockSticky).toHaveBeenCalledWith(1)
    expect(mockFaqSticky).toHaveBeenCalledWith(1)
}, 60_000)

test('createPost restores the FAQ after pinning the daily post', async () => {
    const calls: string[] = []
    const mockDailySticky = vi.fn().mockImplementation(async () => calls.push('daily'))
    const mockFaqSticky = vi.fn().mockImplementation(async () => calls.push('faq'))

    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost' } as never)
    vi.spyOn(reddit, 'getPostById')
        .mockResolvedValueOnce({ id: 't3_newpost', sticky: mockDailySticky } as never)
        .mockResolvedValueOnce({ id: 't3_1kcughf', sticky: mockFaqSticky } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc2' })

    await createPost()

    expect(calls).toEqual(['daily', 'faq'])
}, 60_000)

test('createPost stores the new post id as pinnedPostId in Redis', async () => {
    const mockSticky = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_pinned1' } as never)
    vi.spyOn(reddit, 'getPostById').mockResolvedValue({ id: 't3_pinned1', sticky: mockSticky } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc3' })

    await createPost()

    const stored = await redis.get(PINNED_POST_KEY)
    expect(stored).toBe('t3_pinned1')
}, 60_000)

test('createPost unstickies the previously pinned post before pinning the new one', async () => {
    const mockUnsticky = vi.fn().mockResolvedValue(undefined)
    const mockSticky = vi.fn().mockResolvedValue(undefined)

    await redis.set(PINNED_POST_KEY, 't3_oldpost')

    vi.spyOn(reddit, 'getPostById')
        .mockResolvedValueOnce({ id: 't3_oldpost', unsticky: mockUnsticky } as never)
        .mockResolvedValueOnce({ id: 't3_newpost2', sticky: mockSticky } as never)
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost2' } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc4' })

    await createPost()

    expect(mockUnsticky).toHaveBeenCalled()
    expect(mockSticky).toHaveBeenCalledWith(1)
}, 60_000)

test('createPost succeeds silently when sticky call fails', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_stickyfail' } as never)
    vi.spyOn(reddit, 'getPostById').mockResolvedValue({
        id: 't3_stickyfail',
        sticky: vi.fn().mockRejectedValue(new Error('No mod permissions')),
    } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc5' })

    const result = await createPost()

    expect(result).toEqual({ id: 't3_stickyfail' })
    const stored = await redis.get(PINNED_POST_KEY)
    expect(stored).toBe('t3_stickyfail')
}, 60_000)

test('createPost succeeds silently when unsticky call fails', async () => {
    await redis.set(PINNED_POST_KEY, 't3_oldpost2')

    vi.spyOn(reddit, 'getPostById')
        .mockResolvedValueOnce({
            id: 't3_oldpost2',
            unsticky: vi.fn().mockRejectedValue(new Error('No mod permissions')),
        } as never)
        .mockResolvedValueOnce({
            id: 't3_newpost3',
            sticky: vi.fn().mockResolvedValue(undefined),
        } as never)
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost3' } as never)
    vi.spyOn(stickyCommentModule, 'createStickyComment').mockResolvedValue({ success: true, commentId: 't1_sc6' })

    const result = await createPost()

    expect(result).toEqual({ id: 't3_newpost3' })
}, 60_000)
