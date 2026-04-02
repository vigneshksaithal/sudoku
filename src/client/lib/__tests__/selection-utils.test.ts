import { describe, it, expect } from 'vitest'
import {
    cellKey,
    parseKey,
    setSelection,
    computeRectSelection,
    cellFromPointer,
    clearSelection,
    moveFocus,
    isSelected,
    isMultiSelection,
    EMPTY_SELECTION,
} from '../selection-utils'
import type { CellCoord } from '../notes-utils'

// Helper: check if two CellCoords are equal
const coordEq = (a: CellCoord, b: CellCoord): boolean => a[0] === b[0] && a[1] === b[1]

describe('cellKey and parseKey — round-trip encoding', () => {
    it('encodes (0,0) as "0,0"', () => {
        expect(cellKey(0, 0)).toBe('0,0')
    })

    it('encodes (8,8) as "8,8"', () => {
        expect(cellKey(8, 8)).toBe('8,8')
    })

    it('encodes (3,7) as "3,7"', () => {
        expect(cellKey(3, 7)).toBe('3,7')
    })

    it('parseKey decodes "0,0" back to [0,0]', () => {
        expect(coordEq(parseKey('0,0'), [0, 0])).toBe(true)
    })

    it('parseKey decodes "8,8" back to [8,8]', () => {
        expect(coordEq(parseKey('8,8'), [8, 8])).toBe(true)
    })

    it('parseKey decodes "3,7" back to [3,7]', () => {
        expect(coordEq(parseKey('3,7'), [3, 7])).toBe(true)
    })

    it('round-trips (row, col) through cellKey → parseKey', () => {
        const cases: CellCoord[] = [[0, 0], [0, 8], [8, 0], [8, 8], [4, 4], [2, 6]]
        for (const [r, c] of cases) {
            const [pr, pc] = parseKey(cellKey(r, c))
            expect(pr).toBe(r)
            expect(pc).toBe(c)
        }
    })
})

describe('setSelection — single-cell selection', () => {
    it('returns a selection with exactly one cell', () => {
        const sel = setSelection(3, 4)
        expect(sel.cells.size).toBe(1)
    })

    it('the single cell is the encoded key of the given coords', () => {
        const sel = setSelection(3, 4)
        expect(sel.cells.has(cellKey(3, 4))).toBe(true)
    })

    it('focusCell equals [row, col]', () => {
        const sel = setSelection(3, 4)
        expect(sel.focusCell).not.toBeNull()
        expect(coordEq(sel.focusCell!, [3, 4])).toBe(true)
    })

    it('works for top-left corner (0,0)', () => {
        const sel = setSelection(0, 0)
        expect(sel.cells.size).toBe(1)
        expect(sel.cells.has('0,0')).toBe(true)
        expect(coordEq(sel.focusCell!, [0, 0])).toBe(true)
    })

    it('works for bottom-right corner (8,8)', () => {
        const sel = setSelection(8, 8)
        expect(sel.cells.size).toBe(1)
        expect(sel.cells.has('8,8')).toBe(true)
        expect(coordEq(sel.focusCell!, [8, 8])).toBe(true)
    })
})

describe('computeRectSelection — rectangular box selection', () => {
    it('same cell → 1 cell', () => {
        const sel = computeRectSelection([3, 4], [3, 4])
        expect(sel.cells.size).toBe(1)
        expect(sel.cells.has(cellKey(3, 4))).toBe(true)
        expect(coordEq(sel.focusCell!, [3, 4])).toBe(true)
    })

    it('full row (0,0)→(0,8) → 9 cells', () => {
        const sel = computeRectSelection([0, 0], [0, 8])
        expect(sel.cells.size).toBe(9)
        for (let c = 0; c <= 8; c++) {
            expect(sel.cells.has(cellKey(0, c))).toBe(true)
        }
        expect(coordEq(sel.focusCell!, [0, 8])).toBe(true)
    })

    it('full column (0,0)→(8,0) → 9 cells', () => {
        const sel = computeRectSelection([0, 0], [8, 0])
        expect(sel.cells.size).toBe(9)
        for (let r = 0; r <= 8; r++) {
            expect(sel.cells.has(cellKey(r, 0))).toBe(true)
        }
        expect(coordEq(sel.focusCell!, [8, 0])).toBe(true)
    })

    it('3×3 box (1,1)→(3,3) → 9 cells', () => {
        const sel = computeRectSelection([1, 1], [3, 3])
        expect(sel.cells.size).toBe(9)
        for (let r = 1; r <= 3; r++) {
            for (let c = 1; c <= 3; c++) {
                expect(sel.cells.has(cellKey(r, c))).toBe(true)
            }
        }
        expect(coordEq(sel.focusCell!, [3, 3])).toBe(true)
    })

    it('sets focusCell to the current (second) argument', () => {
        const sel = computeRectSelection([0, 0], [2, 2])
        expect(coordEq(sel.focusCell!, [2, 2])).toBe(true)
    })

    it('reversed anchor/current produces the same cells', () => {
        const forward = computeRectSelection([1, 2], [4, 6])
        const reversed = computeRectSelection([4, 6], [1, 2])
        expect(forward.cells.size).toBe(reversed.cells.size)
        for (const key of forward.cells) {
            expect(reversed.cells.has(key)).toBe(true)
        }
    })
})

describe('cellFromPointer — pointer-to-cell coordinate conversion', () => {
    // 450×450 grid → each cell is 50×50
    const gridRect = { left: 100, top: 100, width: 450, height: 450 }

    it('top-left corner of grid → (0,0)', () => {
        const [row, col] = cellFromPointer(100, 100, gridRect)
        expect(row).toBe(0)
        expect(col).toBe(0)
    })

    it('bottom-right corner of grid → (8,8)', () => {
        // Just inside the last cell: 100 + 449 = 549
        const [row, col] = cellFromPointer(549, 549, gridRect)
        expect(row).toBe(8)
        expect(col).toBe(8)
    })

    it('outside grid — negative coords → clamps to (0,0)', () => {
        const [row, col] = cellFromPointer(50, 50, gridRect)
        expect(row).toBe(0)
        expect(col).toBe(0)
    })

    it('outside grid — beyond grid → clamps to (8,8)', () => {
        const [row, col] = cellFromPointer(700, 700, gridRect)
        expect(row).toBe(8)
        expect(col).toBe(8)
    })

    it('cell boundary edge — exactly on column divider → next cell', () => {
        // Column divider at x = 100 + 50 = 150 → col = floor((150-100)/50) = 1
        const [row, col] = cellFromPointer(150, 100, gridRect)
        expect(col).toBe(1)
        expect(row).toBe(0)
    })

    it('cell boundary edge — exactly on row divider → next cell', () => {
        // Row divider at y = 100 + 50 = 150 → row = floor((150-100)/50) = 1
        const [row, col] = cellFromPointer(100, 150, gridRect)
        expect(row).toBe(1)
        expect(col).toBe(0)
    })

    it('center of cell (4,4)', () => {
        // Cell (4,4) center: x = 100 + 4*50 + 25 = 325, y = 100 + 4*50 + 25 = 325
        const [row, col] = cellFromPointer(325, 325, gridRect)
        expect(row).toBe(4)
        expect(col).toBe(4)
    })
})

describe('clearSelection', () => {
    it('returns EMPTY_SELECTION', () => {
        const cleared = clearSelection()
        expect(cleared.cells.size).toBe(0)
        expect(cleared.focusCell).toBeNull()
    })

    it('returns the same reference as EMPTY_SELECTION', () => {
        expect(clearSelection()).toBe(EMPTY_SELECTION)
    })
})

describe('moveFocus — clamping to grid bounds', () => {
    it('moves focus down by 1 from (3,4)', () => {
        const result = moveFocus([3, 4], 1, 0)
        expect(coordEq(result.focusCell!, [4, 4])).toBe(true)
        expect(result.cells.size).toBe(1)
    })

    it('moves focus right by 1 from (3,4)', () => {
        const result = moveFocus([3, 4], 0, 1)
        expect(coordEq(result.focusCell!, [3, 5])).toBe(true)
    })

    it('moves focus up by 1 from (3,4)', () => {
        const result = moveFocus([3, 4], -1, 0)
        expect(coordEq(result.focusCell!, [2, 4])).toBe(true)
    })

    it('moves focus left by 1 from (3,4)', () => {
        const result = moveFocus([3, 4], 0, -1)
        expect(coordEq(result.focusCell!, [3, 3])).toBe(true)
    })

    it('clamps at top edge — row 0 moving up stays at row 0', () => {
        const result = moveFocus([0, 4], -1, 0)
        expect(result.focusCell![0]).toBe(0)
    })

    it('clamps at bottom edge — row 8 moving down stays at row 8', () => {
        const result = moveFocus([8, 4], 1, 0)
        expect(result.focusCell![0]).toBe(8)
    })

    it('clamps at left edge — col 0 moving left stays at col 0', () => {
        const result = moveFocus([4, 0], 0, -1)
        expect(result.focusCell![1]).toBe(0)
    })

    it('clamps at right edge — col 8 moving right stays at col 8', () => {
        const result = moveFocus([4, 8], 0, 1)
        expect(result.focusCell![1]).toBe(8)
    })

    it('clamps at top-left corner (0,0) moving up-left', () => {
        const result = moveFocus([0, 0], -1, -1)
        expect(coordEq(result.focusCell!, [0, 0])).toBe(true)
    })

    it('clamps at top-right corner (0,8) moving up-right', () => {
        const result = moveFocus([0, 8], -1, 1)
        expect(coordEq(result.focusCell!, [0, 8])).toBe(true)
    })

    it('clamps at bottom-left corner (8,0) moving down-left', () => {
        const result = moveFocus([8, 0], 1, -1)
        expect(coordEq(result.focusCell!, [8, 0])).toBe(true)
    })

    it('clamps at bottom-right corner (8,8) moving down-right', () => {
        const result = moveFocus([8, 8], 1, 1)
        expect(coordEq(result.focusCell!, [8, 8])).toBe(true)
    })

    it('returns a single-cell selection (cells.size === 1)', () => {
        const result = moveFocus([4, 4], 1, 0)
        expect(result.cells.size).toBe(1)
    })

    it('with null focusCell returns EMPTY_SELECTION', () => {
        const result = moveFocus(null, 1, 0)
        expect(result.cells.size).toBe(0)
        expect(result.focusCell).toBeNull()
    })
})

describe('isSelected', () => {
    it('returns true for a cell in the selection', () => {
        const sel = setSelection(2, 5)
        expect(isSelected(sel, 2, 5)).toBe(true)
    })

    it('returns false for a cell not in the selection', () => {
        const sel = setSelection(2, 5)
        expect(isSelected(sel, 3, 5)).toBe(false)
    })

    it('returns false for any cell in EMPTY_SELECTION', () => {
        expect(isSelected(EMPTY_SELECTION, 0, 0)).toBe(false)
        expect(isSelected(EMPTY_SELECTION, 4, 4)).toBe(false)
    })

    it('returns true for all cells in a rectangular selection', () => {
        const sel = computeRectSelection([0, 0], [1, 1])
        expect(isSelected(sel, 0, 0)).toBe(true)
        expect(isSelected(sel, 0, 1)).toBe(true)
        expect(isSelected(sel, 1, 0)).toBe(true)
        expect(isSelected(sel, 1, 1)).toBe(true)
    })

    it('returns false for cells outside a rectangular selection', () => {
        const sel = computeRectSelection([0, 0], [1, 1])
        expect(isSelected(sel, 2, 2)).toBe(false)
        expect(isSelected(sel, 0, 2)).toBe(false)
    })
})

describe('isMultiSelection', () => {
    it('returns false for EMPTY_SELECTION', () => {
        expect(isMultiSelection(EMPTY_SELECTION)).toBe(false)
    })

    it('returns false for a single-cell selection', () => {
        expect(isMultiSelection(setSelection(4, 4))).toBe(false)
    })

    it('returns true for a two-cell rectangular selection', () => {
        const sel = computeRectSelection([0, 0], [0, 1])
        expect(isMultiSelection(sel)).toBe(true)
    })

    it('returns true for a 3×3 rectangular selection', () => {
        const sel = computeRectSelection([0, 0], [2, 2])
        expect(isMultiSelection(sel)).toBe(true)
    })
})
