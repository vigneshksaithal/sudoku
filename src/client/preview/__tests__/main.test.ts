import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { JSDOM } from 'jsdom'
import { VALID_DIFFICULTIES } from '../../lib/constants'
import type { Difficulty } from '../../lib/types'

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    simple: 'Simple',
    easy: 'Easy',
    intermediate: 'Intermediate',
    expert: 'Expert',
}

const mockRequestExpandedMode = vi.fn()

vi.mock('@devvit/web/client', () => ({
    requestExpandedMode: mockRequestExpandedMode,
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
    vi.resetModules()
    await import('../main')
})

describe('Preview screen DOM', () => {
    it('renders the title "Sudoku"', () => {
        const h1 = document.querySelector('h1')
        expect(h1?.textContent).toBe('Sudoku')
    })

    it('renders a single "Play Now" button', () => {
        const buttons = document.querySelectorAll('button')
        expect(buttons).toHaveLength(1)
        const btn = buttons[0]
        expect(btn).toBeDefined()
        expect(btn?.className).toBe('play-btn')
        expect(btn?.textContent).toBe('▶PLAY NOW')
    })
})

// Validates: Requirements 2.5, 4.1
describe('Preview button click stores difficulty before requesting expanded mode', () => {
    it('click stores default difficulty in localStorage and calls requestExpandedMode(event, "game")', () => {
        localStorage.removeItem('sudoku-difficulty')
        mockRequestExpandedMode.mockClear()

        const buttons = document.querySelectorAll('button')
        expect(buttons).toHaveLength(1)
        const btn = buttons[0]
        expect(btn).toBeDefined()

        btn!.click()

        expect(localStorage.getItem('sudoku-difficulty')).toBe('easy')
        expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
        expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
    })

    it('still requests expanded mode when localStorage write throws', async () => {
        mockRequestExpandedMode.mockClear()
        vi.stubGlobal('localStorage', {
            getItem: (): string | null => null,
            setItem: (): void => {
                throw new Error('storage unavailable')
            },
            removeItem: (): void => { },
            clear: (): void => { },
        })

        vi.resetModules()
        await import('../main')

        const firstButton = document.querySelector('button')
        expect(firstButton).toBeDefined()

        firstButton!.click()

        expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
        expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
    })
})
