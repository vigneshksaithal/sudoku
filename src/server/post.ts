import { context, redis, reddit } from '@devvit/web/server'

import { boardToString, generatePuzzleWithDifficulty } from './lib/sudoku'

const DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

export const createPost = async (): Promise<{ id: string }> => {
  const { subredditName } = context
  if (!subredditName) throw new Error('subredditName is required')

  const post = await reddit.submitCustomPost({
    subredditName,
    title: 'Sudoku',
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

  return post
}
