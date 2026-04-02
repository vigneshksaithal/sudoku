import * as fc from 'fast-check'
import { describe, it } from 'vitest'
import {
    EMPTY_SELECTION,
    cellKey,
    clearSelection,
    computeRectSelection,
    moveFocus,
    setSelection,
} from '../selection-utils'
import type { Selection } from '../selection-utils'

// Arbitrary for valid grid coordinates [0,8]
const validCoord = fc.integer({ min: 0, max: 8 })

// Arbitrary for a valid Selection built by computing a rectangular selection from two random coordinate pairs
const validSelection = fc
    .tuple(
        fc.tuple(validCoord, validCoord),
        fc.tuple(validCoord, validCoord),
    )
    .map(([anchor, current]) => computeRectSelection(anchor, current))

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
     * Feature: rectangular-drag-select, Property 6
     * focusCell membership invariant
     * Validates: Requirements 1.3, 2.2
     */
    it('Property 4: focusCell membership invariant', () => {
        type Op =
            | { type: 'set'; row: number; col: number }
            | { type: 'rect'; anchor: [number, number]; current: [number, number] }
            | { type: 'move'; dr: number; dc: number }
            | { type: 'clear' }

        const op: fc.Arbitrary<Op> = fc.oneof(
            fc.record({ type: fc.constant('set' as const), row: validCoord, col: validCoord }),
            fc.record({
                type: fc.constant('rect' as const),
                anchor: fc.tuple(validCoord, validCoord),
                current: fc.tuple(validCoord, validCoord),
            }),
            fc.record({ type: fc.constant('move' as const), dr: delta, dc: delta }),
            fc.record({ type: fc.constant('clear' as const) }),
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
                            case 'rect':
                                sel = computeRectSelection(o.anchor, o.current)
                                break
                            case 'move':
                                sel = moveFocus(sel.focusCell, o.dr, o.dc)
                                break
                            case 'clear':
                                sel = clearSelection()
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
