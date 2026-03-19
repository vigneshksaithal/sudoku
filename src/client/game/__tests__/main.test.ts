import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { DIFFICULTY_STORAGE_KEY, VALID_DIFFICULTIES } from '../../lib/constants'
import type { Difficulty } from '../../lib/types'

const mockMount = vi.fn()

vi.mock('svelte', () => ({ mount: mockMount }))
vi.mock('../../App.svelte', () => ({ default: {} }))
vi.mock('../../app.css', () => ({}))

const makeLocalStorage = (initial?: string): Map<string, string> => {
    const store = new Map<string, string>()
    if (initial !== undefined) store.set(DIFFICULTY_STORAGE_KEY, initial)
    return store
}

const stubEnv = (store: Map<string, string>): void => {
    const appEl = { id: 'app' } as unknown as HTMLElement
    vi.stubGlobal('document', {
        getElementById: (id: string): HTMLElement | null => (id === 'app' ? appEl : null),
    })
    vi.stubGlobal('localStorage', {
        getItem: (key: string): string | null => store.get(key) ?? null,
        setItem: (key: string, value: string): void => { store.set(key, value) },
        removeItem: (key: string): void => { store.delete(key) },
        clear: (): void => { store.clear() },
    })
}

beforeEach(() => {
    mockMount.mockClear()
    vi.resetModules()
})

describe('game/main.ts — unit tests', () => {
    it('defaults to "simple" when localStorage is empty', async () => {
        stubEnv(makeLocalStorage())
        await import('../main')
        expect(mockMount).toHaveBeenCalledOnce()
        const props = mockMount.mock.calls[0]?.[1]?.props as { difficulty: Difficulty }
        expect(props.difficulty).toBe('simple')
    })

    it('defaults to "simple" when localStorage contains an invalid value', async () => {
        stubEnv(makeLocalStorage('HARD'))
        await import('../main')
        expect(mockMount).toHaveBeenCalledOnce()
        const props = mockMount.mock.calls[0]?.[1]?.props as { difficulty: Difficulty }
        expect(props.difficulty).toBe('simple')
    })

    it('defaults to "simple" when localStorage throws on read', async () => {
        const appEl = { id: 'app' } as unknown as HTMLElement
        vi.stubGlobal('document', {
            getElementById: (id: string): HTMLElement | null => (id === 'app' ? appEl : null),
        })
        vi.stubGlobal('localStorage', {
            getItem: (): string | null => {
                throw new Error('storage unavailable')
            },
            setItem: (): void => {},
            removeItem: (): void => {},
            clear: (): void => {},
        })

        await import('../main')

        expect(mockMount).toHaveBeenCalledOnce()
        const props = mockMount.mock.calls[0]?.[1]?.props as { difficulty: Difficulty }
        expect(props.difficulty).toBe('simple')
    })
})

// Property 4: Game screen fetches puzzle for stored difficulty
// Validates: Requirements 3.1, 3.2
describe('Property 4: Game screen mounts App with the difficulty from localStorage', () => {
    it('for any valid difficulty in localStorage, mounts App with that difficulty as a prop', async () => {
        await fc.assert(
            fc.asyncProperty(fc.constantFrom(...VALID_DIFFICULTIES), async (difficulty) => {
                mockMount.mockClear()
                vi.resetModules()
                stubEnv(makeLocalStorage(difficulty))
                await import('../main')
                expect(mockMount).toHaveBeenCalledOnce()
                const props = mockMount.mock.calls[0]?.[1]?.props as { difficulty: Difficulty }
                expect(props.difficulty).toBe(difficulty)
            })
        )
    })
})
