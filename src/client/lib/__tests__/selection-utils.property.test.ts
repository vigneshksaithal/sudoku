import * as fc from 'fast-check'
import { describe, it } from 'vitest'
import {
    EMPTY_SELECTION,
    cellKey,
    extendSelection,
    moveFocus,
    setSelection,
    toggleSelection,
} from '../selection-utils'
import type { Selection } from '../selection-utils'

// Arbitrary for valid grid coordinates [0,8]
const validCoord = fc.integer({ min: 0, max: 8 })

// Arbitrary for a valid Selection built by folding extendSelection over random cells
const validSelection = fc
    .array(fc.tuple(validCoord, validCoord), { minLength: 0, maxLength: 10 })
    .map((cells) =>
        cells.reduce<Selection>(
            (sel, [r, c]) => extendSelection(sel, r, c),
            EMPTY_SELECTION,
        ),
    )

// Arbitrary for delta values in {-1, 0, 1}
const delta = fc.integer({ min: -1, max: 1 })

describe('selection-utils property tests', () => {
    /**
     * Feature: multi-cell-selection, Property 1
     * setSelection produces exclusive single-cell selection
     * Validates: Requirements 1.1, 1.2
     */
    it('Property 1: setSelection produces exclusive single-cell selection', () => {
        fc.assert(
            fc.property(validCoord, validCoord, (row, col) => {
                const result = setSelection(row, col)
                return (
                    result.cells.size === 1 &&
                    result.cells.has(cellKey(row, col)) &&
                    result.focusCell !== null &&
                    result.focusCell[0] === row &&
                    result.focusCell[1] === col
                )
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: multi-cell-selection, Property 2
     * extendSelection adds cell and preserves existing cells
     * Validates: Requirements 2.1, 2.2
     */
    it('Property 2: extendSelection adds cell and preserves existing cells', () => {
        fc.assert(
            fc.property(validSelection, validCoord, validCoord, (selection, row, col) => {
                const result = extendSelection(selection, row, col)
                // result.cells is a superset of original selection.cells
                const isSuperset = [...selection.cells].every((key) => result.cells.has(key))
                // result.cells contains the new cell
                const hasNewCell = result.cells.has(cellKey(row, col))
                // focusCell equals [row, col]
                const correctFocus =
                    result.focusCell !== null &&
                    result.focusCell[0] === row &&
                    result.focusCell[1] === col
                return isSuperset && hasNewCell && correctFocus
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: multi-cell-selection, Property 3
     * toggleSelection is self-inverse
     * Validates: Requirements 3.1
     */
    it('Property 3: toggleSelection is self-inverse', () => {
        fc.assert(
            fc.property(validSelection, validCoord, validCoord, (selection, row, col) => {
                const once = toggleSelection(selection, row, col)
                const twice = toggleSelection(once, row, col)
                // cells set is restored to original (same size and same members)
                if (twice.cells.size !== selection.cells.size) return false
                return [...selection.cells].every((key) => twice.cells.has(key))
            }),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: multi-cell-selection, Property 4
     * focusCell membership invariant
     * Validates: Requirements 1.2, 2.2, 3.2, 3.3
     */
    it('Property 4: focusCell membership invariant', () => {
        // Arbitrary sequence of operations to apply
        type Op =
            | { type: 'set'; row: number; col: number }
            | { type: 'extend'; row: number; col: number }
            | { type: 'toggle'; row: number; col: number }
            | { type: 'move'; dr: number; dc: number }

        const op: fc.Arbitrary<Op> = fc.oneof(
            fc.record({ type: fc.constant('set' as const), row: validCoord, col: validCoord }),
            fc.record({ type: fc.constant('extend' as const), row: validCoord, col: validCoord }),
            fc.record({ type: fc.constant('toggle' as const), row: validCoord, col: validCoord }),
            fc.record({ type: fc.constant('move' as const), dr: delta, dc: delta }),
        )

        const checkInvariant = (sel: Selection): boolean => {
            if (sel.focusCell !== null) {
                return sel.cells.has(cellKey(sel.focusCell[0], sel.focusCell[1]))
            }
            return sel.cells.size === 0
        }

        fc.assert(
            fc.property(
                fc.array(op, { minLength: 1, maxLength: 20 }),
                (ops) => {
                    let sel: Selection = EMPTY_SELECTION
                    for (const o of ops) {
                        switch (o.type) {
                            case 'set':
                                sel = setSelection(o.row, o.col)
                                break
                            case 'extend':
                                sel = extendSelection(sel, o.row, o.col)
                                break
                            case 'toggle':
                                sel = toggleSelection(sel, o.row, o.col)
                                break
                            case 'move':
                                sel = moveFocus(sel.focusCell, o.dr, o.dc)
                                break
                        }
                        if (!checkInvariant(sel)) return false
                    }
                    return true
                },
            ),
            { numRuns: 100 },
        )
    })

    /**
     * Feature: multi-cell-selection, Property 5
     * moveFocus produces valid clamped single selection
     * Validates: Requirements 7.1, 7.2
     */
    it('Property 5: moveFocus produces valid clamped single selection', () => {
        fc.assert(
            fc.property(validCoord, validCoord, delta, delta, (row, col, dr, dc) => {
                const result = moveFocus([row, col], dr, dc)
                return (
                    result.cells.size === 1 &&
                    result.focusCell !== null &&
                    result.focusCell[0] >= 0 &&
                    result.focusCell[0] <= 8 &&
                    result.focusCell[1] >= 0 &&
                    result.focusCell[1] <= 8
                )
            }),
            { numRuns: 100 },
        )
    })
})
