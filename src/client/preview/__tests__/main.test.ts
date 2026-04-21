import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JSDOM } from 'jsdom'

const mockRequestExpandedMode = vi.fn()
const mockConnectRealtime = vi.fn().mockResolvedValue({
    disconnect: vi.fn().mockResolvedValue(undefined),
})

vi.mock('@devvit/web/client', () => ({
    requestExpandedMode: mockRequestExpandedMode,
    connectRealtime: mockConnectRealtime,
}))

const setupEnv = (): { dom: JSDOM; store: Map<string, string> } => {
    const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>')
    const store = new Map<string, string>()

    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('localStorage', {
        getItem: (key: string): string | null => store.get(key) ?? null,
        setItem: (key: string, value: string): void => { store.set(key, value) },
        removeItem: (key: string): void => { store.delete(key) },
        clear: (): void => { store.clear() },
    })

    return { dom, store }
}

beforeEach(async () => {
    const { store } = setupEnv()
    store.clear()
    mockRequestExpandedMode.mockClear()
    mockConnectRealtime.mockClear()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            status: 'success',
            data: {
                channel: 'sudoku_t3_testpost',
                featuredRace: {
                    title: 'Sudoku Daily Race',
                    difficulty: 'intermediate',
                    puzzle: '0'.repeat(81),
                    solverCount: 12,
                    createdAt: 1713571200000,
                },
                topPlayers: [
                    { username: 'player1', adjustedTime: 225, rank: 1 },
                    { username: 'player2', adjustedTime: 240, rank: 2 },
                    { username: 'player3', adjustedTime: 255, rank: 3 },
                ],
                recentCompletions: [],
                playerProfile: {
                    currentStreak: 4,
                    freezeCount: 1,
                },
            },
        }),
    }))
    vi.resetModules()
    await import('../main')
    await Promise.resolve()
})

describe('Preview screen DOM', () => {
    it('renders the title "Sudoku Daily Race"', () => {
        const h1 = document.querySelector('h1')
        expect(h1?.textContent).toContain('Sudoku')
    })

    it('renders a single primary call to action for the featured race', () => {
        const buttons = document.querySelectorAll('button')
        expect(buttons).toHaveLength(1)
        expect(buttons[0]?.textContent).toContain("Play Today's Race")
    })

    it('renders featured difficulty, live solver count, and leaderboard preview from /api/preview-state', () => {
        expect(document.body.textContent).toContain('intermediate')
        expect(document.body.textContent).toContain('12 solvers')
        expect(document.body.textContent).toContain('player1')
        expect(document.body.textContent).toContain('4-day streak')
    })

    it('subscribes to realtime updates for the current post channel', () => {
        expect(mockConnectRealtime).toHaveBeenCalledWith(expect.objectContaining({
            channel: 'sudoku_t3_testpost',
        }))
    })

    it('click stores the featured difficulty before requesting expanded mode', () => {
        localStorage.removeItem('sudoku-difficulty')
        mockRequestExpandedMode.mockClear()
        const firstButton = document.querySelector('button')
        expect(firstButton).toBeDefined()
        firstButton!.click()

        expect(localStorage.getItem('sudoku-difficulty')).toBe('intermediate')
        expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
        expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
    })
})
