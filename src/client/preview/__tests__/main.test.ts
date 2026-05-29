import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { JSDOM } from 'jsdom'
import { VALID_DIFFICULTIES, DIFFICULTY_STORAGE_KEY } from '../../lib/constants'
import type { Difficulty } from '../../lib/types'

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

    it('renders a play button with correct label', () => {
        const buttons = document.querySelectorAll('button')
        expect(buttons).toHaveLength(1)
        expect(buttons[0]?.textContent).toContain('PLAY NOW')
    })
})

describe('Preview button click behavior', () => {
    it('click uses default difficulty "easy" when no previous difficulty is stored', () => {
        localStorage.removeItem(DIFFICULTY_STORAGE_KEY)
        mockRequestExpandedMode.mockClear()

        const btn = document.querySelector('button')
        expect(btn).toBeDefined()

        btn!.click()

        expect(localStorage.getItem(DIFFICULTY_STORAGE_KEY)).toBe('easy')
        expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
        expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
    })

    it('click uses stored difficulty if one exists', async () => {
        // Test all valid difficulties
        for (const difficulty of VALID_DIFFICULTIES) {
            const { store } = setupEnv()
            store.clear()
            store.set(DIFFICULTY_STORAGE_KEY, difficulty)
            mockRequestExpandedMode.mockClear()
            vi.resetModules()
            await import('../main')

            const btn = document.querySelector('button')
            expect(btn).toBeDefined()

            btn!.click()

            expect(localStorage.getItem(DIFFICULTY_STORAGE_KEY)).toBe(difficulty)
            expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
            expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
        }
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

        const btn = document.querySelector('button')
        expect(btn).toBeDefined()

        btn!.click()

        expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
        expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
    })
})