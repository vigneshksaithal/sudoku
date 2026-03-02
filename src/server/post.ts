import { context, redis, reddit } from '@devvit/web/server'

import { boardToString, generateSolution, punchHoles } from './lib/sudoku'

const CELLS_TO_REMOVE = { easy: 35, medium: 45, hard: 54 } as const

type Difficulty = keyof typeof CELLS_TO_REMOVE

export const createPost = async (): Promise<{ id: string }> => {
  const { subredditName } = context
  if (!subredditName) {
    throw new Error('subredditName is required')
  }

  const post = await reddit.submitCustomPost({
    subredditName,
    title: 'Sudoku',
    entry: 'default',
  })

  const fields: Record<string, string> = {
    createdAt: String(Date.now()),
  }

  for (const difficulty of ['easy', 'medium', 'hard'] as const satisfies readonly Difficulty[]) {
    const solution = generateSolution()
    const puzzle = punchHoles(solution, CELLS_TO_REMOVE[difficulty])
    fields[`${difficulty}:solution`] = boardToString(solution)
    fields[`${difficulty}:puzzle`] = boardToString(puzzle)
  }

  await redis.hSet(`puzzle:${post.id}`, fields)

  return post
}
