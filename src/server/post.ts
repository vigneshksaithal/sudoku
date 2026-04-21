import { context, redis, reddit } from '@devvit/web/server'

import { DIFFICULTIES, boardToString, generatePuzzleWithDifficulty } from './lib/sudoku'
import { ensureScoreThread, getRaceKey } from './lib/community-game'

type CreatePostOptions = {
  featuredDifficulty?: (typeof DIFFICULTIES)[number]
  now?: Date
}

export const createPost = async (options: CreatePostOptions = {}): Promise<{ id: string }> => {
  const { subredditName } = context
  if (!subredditName) throw new Error('subredditName is required')
  const now = options.now ?? new Date()
  const featuredDifficulty = options.featuredDifficulty ?? 'intermediate'

  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Sudoku Daily Race • ${now.toISOString().slice(0, 10)}`,
    entry: 'default',
  })

  const fields: Record<string, string> = {
    createdAt: String(now.getTime()),
    title: 'Sudoku Daily Race',
    solverCount: '0',
    'featured:difficulty': featuredDifficulty,
  }

  for (const difficulty of DIFFICULTIES) {
    const result = generatePuzzleWithDifficulty(difficulty)
    if (!result) throw new Error(`Failed to generate ${difficulty} puzzle`)
    fields[`${difficulty}:puzzle`] = boardToString(result.puzzle)
    fields[`${difficulty}:solution`] = boardToString(result.solution)
    if (difficulty === featuredDifficulty) {
      fields['featured:puzzle'] = fields[`${difficulty}:puzzle`]!
      fields['featured:solution'] = fields[`${difficulty}:solution`]!
    }
  }

  await redis.hSet(getRaceKey(post.id), fields)
  await redis.hSet(`puzzle:${post.id}`, fields)

  const scoreThreadId = await ensureScoreThread(post.id)
  await redis.hSet(getRaceKey(post.id), { scoreThreadId })

  return post
}
