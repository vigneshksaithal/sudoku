import { describe, it, expect } from 'vitest'
import { getBoxTint, getCellClasses } from '../grid-utils'
import type { CellClassParams } from '../grid-utils'
import type { CellState } from '../types'

// Helper: build a default CellClassParams with sensible defaults
const createParams = (overrides: Partial<CellClassParams> = {}): CellClassParams => ({
    r: 0,
    c: 0,
    cell: { value: 0, isGiven: false, hasConflict: false },
    selected: false,
    focused: false,
    highlightDigit: null,
    isNoteHighlight: false,
    isPrimary: false,
    isSecondary: false,
    hasConflict: false,
    ...overrides,
})

const givenCell: CellState = { value: 5, isGiven: true, hasConflict: false }
const userCell: CellState = { value: 3, isGiven: false, hasConflict: false }
const conflictCell: CellState = { value: 7, isGiven: false, hasConflict: true }

describe('getBoxTint', () => {
    it('(0,0) → light (box 0,0: even sum)', () => {
        expect(getBoxTint(0, 0)).toBe('light')
    })

    it('(0,3) → dark (box 0,1: odd sum)', () => {
        expect(getBoxTint(0, 3)).toBe('dark')
    })

    it('(3,0) → dark (box 1,0: odd sum)', () => {
        expect(getBoxTint(3, 0)).toBe('dark')
    })

    it('(3,3) → light (box 1,1: even sum)', () => {
        expect(getBoxTint(3, 3)).toBe('light')
    })

    it('(8,8) → light (box 2,2: even sum)', () => {
        expect(getBoxTint(8, 8)).toBe('light')
    })
})

describe('getCellClasses', () => {
    it('selected cell includes amber background', () => {
        const result = getCellClasses(createParams({ selected: true }))
        expect(result).toContain('bg-amber')
    })

    it('given cell includes font-semibold', () => {
        const result = getCellClasses(createParams({ cell: givenCell }))
        expect(result).toContain('font-semibold')
    })

    it('user cell includes text-blue-600', () => {
        const result = getCellClasses(createParams({ cell: userCell }))
        expect(result).toContain('text-blue-600')
    })

    it('conflict cell includes text-red-600', () => {
        const result = getCellClasses(createParams({ cell: conflictCell, hasConflict: true }))
        expect(result).toContain('text-red-600')
    })

    it('selected + digit highlight → amber wins over blue', () => {
        const result = getCellClasses(createParams({
            cell: { value: 5, isGiven: false, hasConflict: false },
            selected: true,
            highlightDigit: 5,
        }))
        expect(result).toContain('bg-amber')
        expect(result).not.toContain('bg-blue-200')
    })

    it('conflict + selected → conflict text color present', () => {
        const result = getCellClasses(createParams({
            cell: conflictCell,
            selected: true,
            hasConflict: true,
        }))
        expect(result).toContain('text-red-600')
    })
})
