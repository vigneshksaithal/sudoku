import { context, redis, reddit } from '@devvit/web/server'
import type { T3 } from '@devvit/shared-types/tid.js'

import { createStickyComment } from './lib/sticky-comment'
import { DIFFICULTIES, boardToString, generatePuzzleWithDifficulty } from './lib/sudoku'

/** Format a Date as DD-MM-YYYY for use in post titles. */
export const formatPostDate = (date: Date): string => {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
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

  return post
}
