import { JSDOM } from 'jsdom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../../lib/constants'

const mockRequestExpandedMode = vi.fn()

vi.mock('@devvit/web/client', () => ({
    requestExpandedMode: mockRequestExpandedMode,
}))

let dom: JSDOM

beforeEach(() => {
    vi.useFakeTimers()
    dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
        url: 'https://example.com',
    })
    vi.stubGlobal('document', dom.window.document)
    vi.stubGlobal('localStorage', dom.window.localStorage)
    mockRequestExpandedMode.mockReset()
    vi.resetModules()
})

afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    dom.window.close()
    vi.unstubAllGlobals()
})

const renderPreview = async (savedDifficulty?: string): Promise<void> => {
    if (savedDifficulty !== undefined) {
        localStorage.setItem(DIFFICULTY_STORAGE_KEY, savedDifficulty)
    }
    await import('../main')
}

const clickPlay = (): void => {
    const button = document.querySelector('button')
    expect(button).not.toBeNull()
    button!.click()
}

describe('Preview screen', () => {
    it('renders the title and a single PLAY NOW button', async () => {
        await renderPreview()

        expect(document.querySelector('h1')?.textContent).toBe('Sudoku')
        expect(document.querySelectorAll('button')).toHaveLength(1)
        expect(document.querySelector('button')?.textContent).toContain('PLAY NOW')
    })

    it.each(VALID_DIFFICULTIES)('stores saved difficulty %s before requesting expanded mode', async (difficulty) => {
        await renderPreview(difficulty)
        localStorage.removeItem(DIFFICULTY_STORAGE_KEY)
        mockRequestExpandedMode.mockImplementation(() => {
            expect(localStorage.getItem(DIFFICULTY_STORAGE_KEY)).toBe(difficulty)
        })

        clickPlay()

        expect(mockRequestExpandedMode).toHaveBeenCalledExactlyOnceWith(expect.any(dom.window.MouseEvent), 'game')
    })

    it.each([undefined, '', 'invalid'])('defaults to easy with saved value %s', async (savedDifficulty) => {
        await renderPreview(savedDifficulty)

        clickPlay()

        expect(localStorage.getItem(DIFFICULTY_STORAGE_KEY)).toBe('easy')
        expect(mockRequestExpandedMode).toHaveBeenCalledOnce()
    })

    it('opens the game when the decorative grid is clicked', async () => {
        await renderPreview('expert')
        const grid = document.querySelector<HTMLElement>('.grid-wrapper')
        expect(grid).not.toBeNull()

        grid!.click()

        expect(localStorage.getItem(DIFFICULTY_STORAGE_KEY)).toBe('expert')
        expect(mockRequestExpandedMode).toHaveBeenCalledExactlyOnceWith(expect.any(dom.window.MouseEvent), 'game')
    })

    it('still requests expanded mode when localStorage reads and writes throw', async () => {
        vi.stubGlobal('localStorage', {
            getItem: (): never => { throw new Error('storage unavailable') },
            setItem: (): never => { throw new Error('storage unavailable') },
        })
        await renderPreview()

        clickPlay()

        expect(mockRequestExpandedMode).toHaveBeenCalledExactlyOnceWith(expect.any(dom.window.MouseEvent), 'game')
    })
})
