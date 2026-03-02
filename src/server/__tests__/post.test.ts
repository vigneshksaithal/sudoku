import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis, reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { createPost } from '../post'

const test = createDevvitTest()

test('createPost generates 3 puzzles, stores in Redis, and submits post', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc123' } as never)

    const result = await createPost()

    expect(reddit.submitCustomPost).toHaveBeenCalledWith({
        subredditName,
        title: 'Sudoku',
        entry: 'default',
    })
    expect(result).toEqual({ id: 't3_abc123' })

    // Verify Redis hash was populated with all expected fields
    const postId = 't3_abc123'
    const easyPuzzle = await redis.hGet(`puzzle:${postId}`, 'easy:puzzle')
    const easySolution = await redis.hGet(`puzzle:${postId}`, 'easy:solution')
    const mediumPuzzle = await redis.hGet(`puzzle:${postId}`, 'medium:puzzle')
    const mediumSolution = await redis.hGet(`puzzle:${postId}`, 'medium:solution')
    const hardPuzzle = await redis.hGet(`puzzle:${postId}`, 'hard:puzzle')
    const hardSolution = await redis.hGet(`puzzle:${postId}`, 'hard:solution')
    const createdAt = await redis.hGet(`puzzle:${postId}`, 'createdAt')

    // All fields are 81-char strings of digits
    for (const field of [easyPuzzle, easySolution, mediumPuzzle, mediumSolution, hardPuzzle, hardSolution]) {
        expect(field).toBeDefined()
        expect(field).toHaveLength(81)
        expect(field).toMatch(/^[0-9]{81}$/)
    }

    // Solutions have no zeros (fully filled)
    for (const sol of [easySolution, mediumSolution, hardSolution]) {
        expect(sol).not.toContain('0')
    }

    // Puzzles have zeros (holes punched)
    for (const puz of [easyPuzzle, mediumPuzzle, hardPuzzle]) {
        expect(puz).toContain('0')
    }

    // createdAt is a numeric timestamp
    expect(createdAt).toBeDefined()
    expect(Number(createdAt)).toBeGreaterThan(0)
})

test('createPost propagates Reddit API errors', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue(new Error('Rate limited'))

    await expect(createPost()).rejects.toThrow('Rate limited')
})
