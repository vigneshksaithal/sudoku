import { createDevvitTest } from '@devvit/test/server/vitest'
import { reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { createPost } from '../post'

const test = createDevvitTest()

test('createPost submits a custom post with correct params', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc123' } as never)

    const result = await createPost()

    expect(reddit.submitCustomPost).toHaveBeenCalledWith({
        subredditName,
        title: 'Post Name',
        entry: 'default',
    })
    expect(result).toEqual({ id: 't3_abc123' })
})

test('createPost propagates Reddit API errors', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue(new Error('Rate limited'))

    await expect(createPost()).rejects.toThrow('Rate limited')
})
