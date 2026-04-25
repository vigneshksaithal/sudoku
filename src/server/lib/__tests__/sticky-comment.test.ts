import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import { expect, describe, it, vi } from 'vitest'

import { createStickyComment } from '../sticky-comment'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeComment = (id: string) => ({
    id,
    distinguish: vi.fn().mockResolvedValue(undefined),
})

const makeReddit = (comment: ReturnType<typeof makeComment>) => ({
    submitComment: vi.fn().mockResolvedValue(comment),
})

// ─── Pure / synchronous tests (no Redis) ─────────────────────────────────────

describe('createStickyComment — submitComment throws', () => {
    it('returns { success: false } without throwing', async () => {
        const reddit = {
            submitComment: vi.fn().mockRejectedValue(new Error('network error')),
        }
        const fakeRedis = { hSet: vi.fn() } as unknown as typeof import('@devvit/redis').redis

        const result = await createStickyComment(
            { reddit, redis: fakeRedis },
            't3_post1',
            'Score thread'
        )

        expect(result).toEqual({ success: false })
        expect(fakeRedis.hSet).not.toHaveBeenCalled()
    })
})

describe('createStickyComment — comment.distinguish throws', () => {
    it('returns { success: false } without throwing', async () => {
        const comment = {
            id: 't1_abc',
            distinguish: vi.fn().mockRejectedValue(new Error('distinguish failed')),
        }
        const reddit = { submitComment: vi.fn().mockResolvedValue(comment) }
        const fakeRedis = { hSet: vi.fn() } as unknown as typeof import('@devvit/redis').redis

        const result = await createStickyComment(
            { reddit, redis: fakeRedis },
            't3_post2',
            'Score thread'
        )

        expect(result).toEqual({ success: false })
        expect(fakeRedis.hSet).not.toHaveBeenCalled()
    })
})

// ─── Redis integration tests ──────────────────────────────────────────────────

const test = createDevvitTest()

describe('createStickyComment — happy path', () => {
    test('returns { success: true, commentId } and stores stickyCommentId in Redis', async () => {
        const postId = 't3_happy1'
        const commentId = 't1_xyz123'
        const comment = makeComment(commentId)
        const reddit = makeReddit(comment)

        const result = await createStickyComment(
            { reddit, redis },
            postId,
            '🏆 Score Thread'
        )

        expect(result).toEqual({ success: true, commentId })
    })

    test('calls distinguish(true) to distinguish and sticky the comment', async () => {
        const postId = 't3_happy2'
        const comment = makeComment('t1_dist1')
        const reddit = makeReddit(comment)

        await createStickyComment({ reddit, redis }, postId, 'Score thread')

        expect(comment.distinguish).toHaveBeenCalledWith(true)
    })

    test('stores stickyCommentId in puzzle:{postId} Redis hash', async () => {
        const postId = 't3_redis1'
        const commentId = 't1_stored99'
        const comment = makeComment(commentId)
        const reddit = makeReddit(comment)

        await createStickyComment({ reddit, redis }, postId, 'Score thread')

        const stored = await redis.hGet(`puzzle:${postId}`, 'stickyCommentId')
        expect(stored).toBe(commentId)
    })

    test('passes postId and text to submitComment', async () => {
        const postId = 't3_args1'
        const text = '🏆 **Score Thread** — Share your solve time!'
        const comment = makeComment('t1_args1')
        const reddit = makeReddit(comment)

        await createStickyComment({ reddit, redis }, postId, text)

        expect(reddit.submitComment).toHaveBeenCalledWith({ id: postId, text })
    })
})
