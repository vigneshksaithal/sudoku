import { context, redis, reddit } from '@devvit/web/server'
import type { T3 } from '@devvit/shared-types/tid.js'

import { createStickyComment } from './lib/sticky-comment'
import { DIFFICULTIES, boardToString, generatePuzzleWithDifficulty } from './lib/sudoku'

/** Redis key for tracking the currently pinned post. */
const PINNED_POST_KEY = 'pinnedPostId'

/** Permanent r/Sudoku FAQ post, restored after each daily game post. */
const FAQ_POST_ID = 't3_1kcughf'

/** Format a Date as DD-MM-YYYY for use in post titles. */
export const formatPostDate = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

/**
 * Unpin the previously pinned post, if any. Errors are swallowed so post
 * creation is never blocked by a missing mod permission.
 */
const unpinPreviousPost = async (): Promise<void> => {
  const previousPostId = await redis.get(PINNED_POST_KEY)
  if (!previousPostId) return

  try {
    const previousPost = await reddit.getPostById(previousPostId as T3)
    await previousPost.unsticky()
  } catch {
    // Silently ignore — app may not have mod permissions or post may be deleted
  }
}

/**
 * Pin the given post to sticky slot 3, reserving slots 1 and 2 for the
 * permanent FAQ and weekly discussion thread. Errors are swallowed so post
 * creation is never blocked by a missing mod permission.
 */
const pinPost = async (postId: string): Promise<void> => {
  try {
    const post = await reddit.getPostById(postId as T3)
    await post.sticky(3)
  } catch {
    // Silently ignore — app may not have mod permissions
  }

  await redis.set(PINNED_POST_KEY, postId)
}

/**
 * Restore the permanent FAQ to sticky slot 1 after a daily game has been
 * posted. Errors are swallowed so a missing mod permission never prevents
 * creation of the daily post.
 */
const restoreFaqPost = async (): Promise<void> => {
  try {
    const faqPost = await reddit.getPostById(FAQ_POST_ID as T3)
    await faqPost.sticky(1)
  } catch {
    // Silently ignore — app may not have mod permissions or post may be deleted
  }
}

export const createPost = async (): Promise<{ id: string }> => {
  const { subredditName } = context
  if (!subredditName) throw new Error('subredditName is required')

  const title = `Sudoku #${formatPostDate(new Date())}`

  const post = await reddit.submitCustomPost({
    subredditName,
    title,
    entry: 'default',
  })

  const fields: Record<string, string> = { createdAt: String(Date.now()) }

  for (const difficulty of DIFFICULTIES) {
    const result = generatePuzzleWithDifficulty(difficulty)
    if (!result) throw new Error(`Failed to generate ${difficulty} puzzle`)
    fields[`${difficulty}:puzzle`] = boardToString(result.puzzle)
    fields[`${difficulty}:solution`] = boardToString(result.solution)
  }

  await redis.hSet(`puzzle:${post.id}`, fields)

  await createStickyComment(
    { reddit, redis },
    post.id as T3,
    '🏆 **Score Thread** — Share your solve time! Use the "Comment My Score" button after completing the puzzle.'
  )

  await unpinPreviousPost()
  await pinPost(post.id)
  await restoreFaqPost()

  return post
}
