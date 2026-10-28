import { Header } from '@devvit/shared-types/Header.js'
import { MOCK_HEADERS } from '@devvit/shared-types/test/index.js'
import { createDevvitTest } from '@devvit/test/server/vitest'
import { redis } from '@devvit/redis'
import { reddit } from '@devvit/reddit'
import { expect, vi } from 'vitest'
import { app } from '../index'

;(MOCK_HEADERS as Record<string, string>)[Header.Post] = 't3_testpost'

const test = createDevvitTest({ userId: 't2_integrity', username: 'integrity' })
const solution = '1'.repeat(81)

const submit = (board: string, completionTime: number): Promise<Response> => app.request('/api/solve', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ difficulty: 'easy', board, completionTime, hintsUsed: 0, mistakesCount: 0, notesUsed: false }),
})

const seed = async (): Promise<void> => {
    await redis.hSet('puzzle:t3_testpost', { 'easy:puzzle': '0'.repeat(81), 'easy:solution': solution })
    vi.spyOn(reddit, 'getCurrentUsername').mockResolvedValue('integrity')
}

test('rejects an incorrect completed board', async () => {
    await seed()
    expect((await submit('2'.repeat(81), 120)).status).toBe(400)
    expect(await redis.exists('solve:t3_testpost:easy:t2_integrity')).toBe(0)
})

test('does not rank a solve without a server start time', async () => {
    await seed()
    expect((await submit(solution, 120)).status).toBe(200)
    expect(await redis.zScore('leaderboard:global:easy', 't2_integrity')).toBeUndefined()
})

test('records a correctly solved board using server elapsed time', async () => {
    await seed()
    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValue(1000000)
    const start = await app.request('/api/solve/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }),
    })
    expect(start.status).toBe(200)
    clock.mockReturnValue(1200000)
    const response = await submit(solution, 199)
    const json = await response.json()
    expect(response.status).toBe(200)
    expect(json.data.completionTime).toBe(200)
    expect(await redis.zScore('leaderboard:global:easy', 't2_integrity')).toBe(200)
    clock.mockRestore()
})

test('does not rank implausibly fast solves even with a start', async () => {
    await seed()
    await app.request('/api/solve/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }),
    })
    const response = await submit(solution, 0)
    expect(response.status).toBe(200)
    expect(await redis.zScore('leaderboard:global:easy', 't2_integrity')).toBeUndefined()
})

test('marks an implausibly low client timer unranked', async () => {
    await seed()
    const clock = vi.spyOn(Date, 'now')
    clock.mockReturnValue(1000000)
    await app.request('/api/solve/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }),
    })
    clock.mockReturnValue(1200000)
    const response = await submit(solution, 1)
    expect(response.status).toBe(200)
    expect(await redis.zScore('leaderboard:global:easy', 't2_integrity')).toBeUndefined()
    clock.mockRestore()
})

test('excludes a server-recorded pause from a ranked solve', async () => {
    await seed()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000000)
    const action = (name: string): Promise<Response> => app.request(`/api/solve/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }),
    })
    await action('start')
    clock.mockReturnValue(1100000)
    expect((await action('pause')).status).toBe(200)
    clock.mockReturnValue(1400000)
    expect((await action('resume')).status).toBe(200)
    clock.mockReturnValue(1500000)
    const response = await submit(solution, 200)
    const json = await response.json()
    expect(json.data.completionTime).toBe(200)
    expect(await redis.zScore('leaderboard:global:easy', 't2_integrity')).toBe(200)
    clock.mockRestore()
})

test('allows multiple pause and resume cycles', async () => {
    await seed()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000000)
    const action = (name: string): Promise<Response> => app.request(`/api/solve/${name}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }),
    })
    await action('start')
    clock.mockReturnValue(1100000)
    await action('pause')
    clock.mockReturnValue(1200000)
    await action('resume')
    clock.mockReturnValue(1250000)
    expect((await action('pause')).status).toBe(200)
    clock.mockReturnValue(1350000)
    expect((await action('resume')).status).toBe(200)
    clock.mockReturnValue(1400000)
    const response = await submit(solution, 200)
    expect((await response.json()).data.completionTime).toBe(200)
    clock.mockRestore()
})

test('does not rank a solve while the server timer is paused', async () => {
    await seed()
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000000)
    for (const action of ['start', 'pause']) {
        if (action === 'pause') clock.mockReturnValue(1200000)
        await app.request(`/api/solve/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ difficulty: 'easy' }) })
    }
    const response = await submit(solution, 200)
    expect((await response.json()).data.unranked).toBe(true)
    expect(await redis.zScore('leaderboard:global:easy', 't2_integrity')).toBeUndefined()
    clock.mockRestore()
})

test('rejects unsafe integer values for solve statistics', async () => {
    await seed()
    const response = await submit(solution, Number.MAX_SAFE_INTEGER + 1)
    expect(response.status).toBe(400)
})
