import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { JSDOM } from 'jsdom'
import { VALID_DIFFICULTIES } from '../../lib/constants'

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

    it('renders four buttons with correct labels (simple, easy, intermediate, expert)', () => {
        const buttons = document.querySelectorAll('button')
        expect(buttons).toHaveLength(4)
        const labels = Array.from(buttons).map((b) => b.textContent)
        expect(labels).toEqual(['simple', 'easy', 'intermediate', 'expert'])
    })
})

// Property 3: Preview button click stores difficulty before requesting expanded mode
// Validates: Requirements 2.5, 4.1
describe('Property 3: Preview button click stores difficulty before requesting expanded mode', () => {
    it('for each valid difficulty, click stores it in localStorage and calls requestExpandedMode(event, "game")', () => {
        fc.assert(
            fc.property(fc.constantFrom(...VALID_DIFFICULTIES), (difficulty) => {
                localStorage.removeItem('sudoku-difficulty')
                mockRequestExpandedMode.mockClear()

                const buttons = Array.from(document.querySelectorAll('button'))
                const btn = buttons.find((b) => b.textContent === difficulty)
                expect(btn).toBeDefined()

                btn!.click()

                expect(localStorage.getItem('sudoku-difficulty')).toBe(difficulty)
                expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
                expect(mockRequestExpandedMode.mock.calls[0]?.[1]).toBe('game')
            })
        )
    })
})
