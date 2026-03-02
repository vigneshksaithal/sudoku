import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { context, redis } from '@devvit/web/server'
import { expect } from 'vitest'

    // Inject postId into the test context — createDevvitTest doesn't support it natively
    ; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

import { app } from '../index'

const test = createDevvitTest()

// --- GET /api/puzzle ---

test('GET /api/puzzle returns three puzzle strings', async () => {
    const postId = context.postId!
    await redis.hSet(`puzzle:${postId}`, {
        'easy:puzzle': '5'.repeat(81),
        'easy:solution': '1'.repeat(81),
        'medium:puzzle': '6'.repeat(81),
        'medium:solution': '2'.repeat(81),
        'hard:puzzle': '7'.repeat(81),
        'hard:solution': '3'.repeat(81),
        createdAt: '1234567890',
    })

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
        status: 'success',
        data: {
            easy: '5'.repeat(81),
            medium: '6'.repeat(81),
            hard: '7'.repeat(81),
        },
    })
})

test('GET /api/puzzle omits solutions from response', async () => {
    const postId = context.postId!
    await redis.hSet(`puzzle:${postId}`, {
        'easy:puzzle': '5'.repeat(81),
        'easy:solution': '1'.repeat(81),
        'medium:puzzle': '6'.repeat(81),
        'medium:solution': '2'.repeat(81),
        'hard:puzzle': '7'.repeat(81),
        'hard:solution': '3'.repeat(81),
        createdAt: '1234567890',
    })

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(json.data).not.toHaveProperty('easy:solution')
    expect(json.data).not.toHaveProperty('medium:solution')
    expect(json.data).not.toHaveProperty('hard:solution')
})


test('GET /api/puzzle returns 400 when puzzle not found', async () => {
    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.status).toBe('error')
    expect(json.message).toBeDefined()
})

// --- POST /api/validate ---

test('POST /api/validate returns valid: true for correct board', async () => {
    const postId = context.postId!
    const solution = '1'.repeat(81)
    await redis.hSet(`puzzle:${postId}`, {
        'easy:solution': solution,
        'easy:puzzle': '0'.repeat(81),
    })

    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: solution, difficulty: 'easy' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ valid: true })
})

test('POST /api/validate returns valid: false for incorrect board', async () => {
    const postId = context.postId!
    await redis.hSet(`puzzle:${postId}`, {
        'easy:solution': '1'.repeat(81),
        'easy:puzzle': '0'.repeat(81),
    })

    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: '2'.repeat(81), difficulty: 'easy' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ valid: false })
})

test('POST /api/validate returns 400 for missing fields', async () => {
    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
})

test('POST /api/validate returns 400 for invalid difficulty', async () => {
    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: '1'.repeat(81), difficulty: 'extreme' }),
    })

    expect(res.status).toBe(400)
})

test('POST /api/validate returns 400 for invalid board length', async () => {
    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: '123', difficulty: 'easy' }),
    })

    expect(res.status).toBe(400)
})
