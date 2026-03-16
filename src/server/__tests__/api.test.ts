import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { context, redis } from '@devvit/web/server'
import { expect } from 'vitest'

    // Inject postId into the test context — createDevvitTest doesn't support it natively
    ; (MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

import { app } from '../index'

const test = createDevvitTest()

const DIFFICULTIES = ['simple', 'easy', 'intermediate', 'expert'] as const

const seedPuzzles = async (postId: string): Promise<void> => {
    const fields: Record<string, string> = { createdAt: '1234567890' }
    DIFFICULTIES.forEach((d, i) => {
        fields[`${d}:puzzle`] = String(i + 1).repeat(81)
        fields[`${d}:solution`] = String(i + 5).repeat(81)
    })
    await redis.hSet(`puzzle:${postId}`, fields)
}

// --- GET /api/ping ---

test('GET /api/ping returns status success with pong message', async () => {
    const res = await app.request('/api/ping')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.message).toBe('pong')
})

// --- GET /api/puzzle ---

test('GET /api/puzzle returns four puzzle strings in data.puzzles', async () => {
    const postId = context.postId!
    await seedPuzzles(postId)

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('success')
    expect(json.data.puzzles).toEqual({
        simple: '1'.repeat(81),
        easy: '2'.repeat(81),
        intermediate: '3'.repeat(81),
        expert: '4'.repeat(81),
    })
})

test('GET /api/puzzle returns one solution string per difficulty in data.solutions', async () => {
    const postId = context.postId!
    await seedPuzzles(postId)

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.solutions).toEqual({
        simple: '5'.repeat(81),
        easy: '6'.repeat(81),
        intermediate: '7'.repeat(81),
        expert: '8'.repeat(81),
    })
})

test('GET /api/puzzle solution strings are 81-char digits 1-9 only', async () => {
    const postId = context.postId!
    await seedPuzzles(postId)

    const res = await app.request('/api/puzzle')
    const json = await res.json()

    for (const d of DIFFICULTIES) {
        const solution: string = json.data.solutions[d]
        expect(solution).toHaveLength(81)
        expect(/^[1-9]{81}$/.test(solution)).toBe(true)
    }
})

test('GET /api/puzzle returns 400 when puzzles not found', async () => {
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
    await redis.hSet(`puzzle:${postId}`, { 'simple:solution': solution, 'simple:puzzle': '0'.repeat(81) })

    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: solution, difficulty: 'simple' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ valid: true })
})

test('POST /api/validate returns valid: false for incorrect board', async () => {
    const postId = context.postId!
    await redis.hSet(`puzzle:${postId}`, { 'easy:solution': '1'.repeat(81), 'easy:puzzle': '0'.repeat(81) })

    const res = await app.request('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: '2'.repeat(81), difficulty: 'easy' }),
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ valid: false })
})

test('POST /api/validate accepts all four difficulties', async () => {
    const postId = context.postId!
    for (const d of DIFFICULTIES) {
        const solution = '1'.repeat(81)
        await redis.hSet(`puzzle:${postId}`, { [`${d}:solution`]: solution })
        const res = await app.request('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: solution, difficulty: d }),
        })
        expect(res.status).toBe(200)
    }
})

test('POST /api/validate returns 400 for old difficulty values', async () => {
    for (const d of ['medium', 'hard']) {
        const res = await app.request('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board: '1'.repeat(81), difficulty: d }),
        })
        expect(res.status).toBe(400)
    }
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
