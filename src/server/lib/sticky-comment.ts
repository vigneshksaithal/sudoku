import type { RedisClient } from '@devvit/redis'
import type { T1, T3 } from '@devvit/shared-types/tid.js'

// ─── Types ────────────────────────────────────────────────────────────────────

type SubmitCommentOpts = {
    id: T1 | T3
    text: string
}

type Comment = {
    id: T1
    distinguish: (makeSticky?: boolean) => Promise<void>
}

export type StickyCommentDeps = {
    reddit: { submitComment: (opts: SubmitCommentOpts) => Promise<Comment> }
    redis: RedisClient
}

export type StickyCommentResult =
    | { success: true; commentId: string }
    | { success: false }

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Submit a distinguished, stickied comment as the app account on the given post,
 * then store the comment ID in the `puzzle:{postId}` Redis hash.
 *
 * Never throws — catches all errors, logs them, and returns `{ success: false }`.
 */
export const createStickyComment = async (
    deps: StickyCommentDeps,
    postId: T3,
    text: string
): Promise<StickyCommentResult> => {
    try {
        const comment = await deps.reddit.submitComment({ id: postId, text })

        // distinguish(true) both distinguishes the comment and stickies it
        await comment.distinguish(true)

        await deps.redis.hSet(`puzzle:${postId}`, { stickyCommentId: comment.id })

        return { success: true, commentId: comment.id }
    } catch (error) {
        console.error('[createStickyComment] Failed to create sticky comment:', error)
        return { success: false }
    }
}
