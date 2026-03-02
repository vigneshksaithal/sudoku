import { createDevvitTest } from '@devvit/test/server/vitest'
import { reddit } from '@devvit/web/server'
import { expect, vi } from 'vitest'

import { app } from '../index'

const test = createDevvitTest()

test('POST /internal/on-app-install returns navigateTo on success', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_newpost' } as never)

    const res = await app.request('/internal/on-app-install', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.navigateTo).toBe(
        `https://reddit.com/r/${subredditName}/comments/t3_newpost`
    )
})

test('POST /internal/menu/post-create returns navigateTo on success', async ({ subredditName }) => {
    vi.spyOn(reddit, 'submitCustomPost').mockResolvedValue({ id: 't3_abc' } as never)

    const res = await app.request('/internal/menu/post-create', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.navigateTo).toBe(
        `https://reddit.com/r/${subredditName}/comments/t3_abc`
    )
})

test('POST /internal/on-app-install returns error on failure', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue(new Error('API down'))

    const res = await app.request('/internal/on-app-install', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ status: 'error', message: 'API down' })
})

test('POST /internal/on-app-install handles non-Error throws', async () => {
    vi.spyOn(reddit, 'submitCustomPost').mockRejectedValue('string error')

    const res = await app.request('/internal/on-app-install', { method: 'POST' })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json).toEqual({ status: 'error', message: 'Failed to create post' })
})
