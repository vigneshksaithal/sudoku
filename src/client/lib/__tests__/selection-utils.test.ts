import { describe, it, expect } from 'vitest'
import {
    cellKey,
    parseKey,
    setSelection,
    extendSelection,
    toggleSelection,
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

describe('extendSelection — adds cell and preserves existing', () => {
    it('adds a new cell to an existing single-cell selection', () => {
        const sel = setSelection(1, 1)
        const extended = extendSelection(sel, 2, 2)
        expect(extended.cells.size).toBe(2)
        expect(extended.cells.has(cellKey(1, 1))).toBe(true)
        expect(extended.cells.has(cellKey(2, 2))).toBe(true)
    })

    it('updates focusCell to the newly added cell', () => {
        const sel = setSelection(1, 1)
        const extended = extendSelection(sel, 2, 2)
        expect(coordEq(extended.focusCell!, [2, 2])).toBe(true)
    })

    it('preserves all existing cells when adding a third cell', () => {
        const sel = extendSelection(setSelection(0, 0), 0, 1)
        const extended = extendSelection(sel, 0, 2)
        expect(extended.cells.size).toBe(3)
        expect(extended.cells.has(cellKey(0, 0))).toBe(true)
        expect(extended.cells.has(cellKey(0, 1))).toBe(true)
        expect(extended.cells.has(cellKey(0, 2))).toBe(true)
    })

    it('extending EMPTY_SELECTION adds the cell', () => {
        const extended = extendSelection(EMPTY_SELECTION, 5, 5)
        expect(extended.cells.size).toBe(1)
        expect(extended.cells.has(cellKey(5, 5))).toBe(true)
        expect(coordEq(extended.focusCell!, [5, 5])).toBe(true)
    })

    it('is idempotent — extending with a cell already in the selection does not duplicate it', () => {
        const sel = setSelection(3, 3)
        const extended = extendSelection(sel, 3, 3)
        expect(extended.cells.size).toBe(1)
        expect(extended.cells.has(cellKey(3, 3))).toBe(true)
    })

    it('idempotent extend still updates focusCell to the duplicate cell', () => {
        const sel = extendSelection(setSelection(3, 3), 4, 4)
        // extend back to (3,3) which is already in the set
        const extended = extendSelection(sel, 3, 3)
        expect(extended.cells.size).toBe(2)
        expect(coordEq(extended.focusCell!, [3, 3])).toBe(true)
    })
})

describe('toggleSelection — adds when absent, removes when present', () => {
    it('adds a cell when it is not in the selection', () => {
        const sel = setSelection(0, 0)
        const toggled = toggleSelection(sel, 1, 1)
        expect(toggled.cells.has(cellKey(1, 1))).toBe(true)
    })

    it('sets focusCell to the newly added cell', () => {
        const sel = setSelection(0, 0)
        const toggled = toggleSelection(sel, 1, 1)
        expect(coordEq(toggled.focusCell!, [1, 1])).toBe(true)
    })

    it('removes a cell when it is already in the selection', () => {
        const sel = extendSelection(setSelection(0, 0), 1, 1)
        const toggled = toggleSelection(sel, 1, 1)
        expect(toggled.cells.has(cellKey(1, 1))).toBe(false)
    })

    it('preserves other cells when removing one', () => {
        const sel = extendSelection(setSelection(0, 0), 1, 1)
        const toggled = toggleSelection(sel, 1, 1)
        expect(toggled.cells.has(cellKey(0, 0))).toBe(true)
    })

    it('keeps focusCell on previous focusCell when removing a non-focus cell', () => {
        // focusCell is (1,1), remove (0,0)
        const sel = extendSelection(setSelection(0, 0), 1, 1)
        const toggled = toggleSelection(sel, 0, 0)
        expect(coordEq(toggled.focusCell!, [1, 1])).toBe(true)
    })

    it('removing the only cell yields empty selection with null focusCell', () => {
        const sel = setSelection(4, 4)
        const toggled = toggleSelection(sel, 4, 4)
        expect(toggled.cells.size).toBe(0)
        expect(toggled.focusCell).toBeNull()
    })

    it('toggling on EMPTY_SELECTION adds the cell', () => {
        const toggled = toggleSelection(EMPTY_SELECTION, 2, 3)
        expect(toggled.cells.size).toBe(1)
        expect(toggled.cells.has(cellKey(2, 3))).toBe(true)
        expect(coordEq(toggled.focusCell!, [2, 3])).toBe(true)
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

    it('returns true for all cells in a multi-cell selection', () => {
        const sel = extendSelection(setSelection(0, 0), 1, 1)
        expect(isSelected(sel, 0, 0)).toBe(true)
        expect(isSelected(sel, 1, 1)).toBe(true)
    })
})

describe('isMultiSelection', () => {
    it('returns false for EMPTY_SELECTION', () => {
        expect(isMultiSelection(EMPTY_SELECTION)).toBe(false)
    })

    it('returns false for a single-cell selection', () => {
        expect(isMultiSelection(setSelection(4, 4))).toBe(false)
    })

    it('returns true for a two-cell selection', () => {
        const sel = extendSelection(setSelection(0, 0), 1, 1)
        expect(isMultiSelection(sel)).toBe(true)
    })

    it('returns true for a three-cell selection', () => {
        const sel = extendSelection(extendSelection(setSelection(0, 0), 1, 1), 2, 2)
        expect(isMultiSelection(sel)).toBe(true)
    })
})
