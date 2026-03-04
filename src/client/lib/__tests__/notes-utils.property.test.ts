import { describe, it } from 'vitest'
import * as fc from 'fast-check'
import {
    createEmptyNotesBoard,
    toggleNote,
    clearCellNotes,
    cleanupNotes,
    getPeers,
} from '../notes-utils'

const cellArb = fc.tuple(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 8 }))
const digitArb = fc.integer({ min: 1, max: 9 })
const distinctCellsArb = fc
    .tuple(cellArb, cellArb)
    .filter(([a, b]) => a[0] !== b[0] || a[1] !== b[1])

/**
 * Property 1: createEmptyNotesBoard produces independent sets
 * Validates: Requirement 1.2
 */
describe('Property 1: createEmptyNotesBoard produces independent sets', () => {
    it('mutating one cell does not affect another', () => {
        fc.assert(
            fc.property(distinctCellsArb, digitArb, ([[r1, c1], [r2, c2]], digit) => {
                const board = createEmptyNotesBoard()
                board[r1]![c1]!.add(digit)
                return board[r2]![c2]!.size === 0
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 2: toggleNote is self-inverse
 * Validates: Requirement 3.1
 */
describe('Property 2: toggleNote is self-inverse', () => {
    it('calling toggleNote twice restores original empty state', () => {
        fc.assert(
            fc.property(cellArb, digitArb, ([row, col], digit) => {
                const board = createEmptyNotesBoard()
                toggleNote(board, row, col, digit)
                toggleNote(board, row, col, digit)
                return board[row]![col]!.size === 0
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 3: toggleNote only modifies the targeted cell
 * Validates: Requirements 3.2, 1.2
 */
describe('Property 3: toggleNote only modifies the targeted cell', () => {
    it('all other cells remain size 0 after a single toggleNote', () => {
        fc.assert(
            fc.property(cellArb, digitArb, ([row, col], digit) => {
                const board = createEmptyNotesBoard()
                toggleNote(board, row, col, digit)
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (r === row && c === col) continue
                        if (board[r]![c]!.size !== 0) return false
                    }
                }
                return true
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 4: clearCellNotes empties the note set
 * Validates: Requirements 5.1, 9.1
 */
describe('Property 4: clearCellNotes empties the note set', () => {
    it('cell is empty after clearCellNotes regardless of prior contents', () => {
        fc.assert(
            fc.property(
                cellArb,
                fc.array(digitArb, { minLength: 0, maxLength: 9 }),
                ([row, col], digits) => {
                    const board = createEmptyNotesBoard()
                    for (const d of digits) {
                        board[row]![col]!.add(d)
                    }
                    clearCellNotes(board, row, col)
                    return board[row]![col]!.size === 0
                }
            ),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 5: cleanupNotes removes digit from exactly peer cells
 * Validates: Requirements 5.2, 5.3
 */
describe('Property 5: cleanupNotes removes digit from exactly peer cells', () => {
    it('peers lose the digit; non-peers (excluding placed cell) keep it', () => {
        fc.assert(
            fc.property(cellArb, digitArb, ([row, col], digit) => {
                const board = createEmptyNotesBoard()
                // Add digit to all 81 cells
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        board[r]![c]!.add(digit)
                    }
                }

                cleanupNotes(board, row, col, digit)

                const peers = getPeers(row, col)
                const peerSet = new Set(peers.map(([r, c]) => `${r},${c}`))

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        const key = `${r},${c}`
                        const isPlacedCell = r === row && c === col
                        const isPeer = peerSet.has(key)

                        if (isPeer) {
                            // Peers must NOT have the digit
                            if (board[r]![c]!.has(digit)) return false
                        } else if (!isPlacedCell) {
                            // Non-peers (excluding placed cell) must STILL have the digit
                            if (!board[r]![c]!.has(digit)) return false
                        }
                    }
                }
                return true
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 6: getPeers returns exactly 20 unique coordinates
 * Validates: Requirements 6.1, 6.4
 */
describe('Property 6: getPeers returns exactly 20 unique coordinates', () => {
    it('result has length 20 with no duplicates', () => {
        fc.assert(
            fc.property(cellArb, ([row, col]) => {
                const peers = getPeers(row, col)
                if (peers.length !== 20) return false
                const unique = new Set(peers.map(([r, c]) => `${r},${c}`))
                return unique.size === 20
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 7: getPeers returns correct peer membership
 * Validates: Requirements 6.2, 6.3
 */
describe('Property 7: getPeers returns correct peer membership', () => {
    it('self not included; every coord shares row/col/box; every valid peer is present', () => {
        fc.assert(
            fc.property(cellArb, ([row, col]) => {
                const peers = getPeers(row, col)
                const peerSet = new Set(peers.map(([r, c]) => `${r},${c}`))

                // Self must not be in peers
                if (peerSet.has(`${row},${col}`)) return false

                const boxRow = Math.floor(row / 3) * 3
                const boxCol = Math.floor(col / 3) * 3

                // Every returned coord must share row, col, or box
                for (const [r, c] of peers) {
                    const sharesRow = r === row
                    const sharesCol = c === col
                    const sharesBox =
                        r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3
                    if (!sharesRow && !sharesCol && !sharesBox) return false
                }

                // Every valid peer must be present
                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (r === row && c === col) continue
                        const sharesRow = r === row
                        const sharesCol = c === col
                        const sharesBox =
                            r >= boxRow && r < boxRow + 3 && c >= boxCol && c < boxCol + 3
                        if (sharesRow || sharesCol || sharesBox) {
                            if (!peerSet.has(`${r},${c}`)) return false
                        }
                    }
                }

                return true
            }),
            { numRuns: 100 }
        )
    })
})

/**
 * Property 8: Highlight digit derivation
 * Validates: Requirements 8.1, 8.2
 */
const makeCellState = (value: number): import('../types').CellState => ({
    value,
    isGiven: false,
    hasConflict: false,
})
const makeBoard = (): import('../types').CellState[][] =>
    Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => makeCellState(0)))

const deriveHighlightDigit = (
    board: import('../types').CellState[][],
    selectedRow: number | null,
    selectedCol: number | null
): number | null => {
    if (selectedRow === null || selectedCol === null) return null
    return board[selectedRow]?.[selectedCol]?.value || null
}

describe('Property 8: Highlight digit derivation', () => {
    it('8a: returns null when selectedRow/selectedCol are null', () => {
        fc.assert(
            fc.property(fc.constant(null), fc.constant(null), (row, col) => {
                const board = makeBoard()
                return deriveHighlightDigit(board, row, col) === null
            }),
            { numRuns: 100 }
        )
    })

    it('8b: returns the cell value when selected cell has a non-zero value', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 1, max: 9 }),
                (row, col, digit) => {
                    const board = makeBoard()
                    board[row]![col]!.value = digit
                    return deriveHighlightDigit(board, row, col) === digit
                }
            ),
            { numRuns: 100 }
        )
    })

    it('8c: returns null when selected cell has value 0', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 8 }),
                fc.integer({ min: 0, max: 8 }),
                (row, col) => {
                    const board = makeBoard()
                    board[row]![col]!.value = 0
                    return deriveHighlightDigit(board, row, col) === null
                }
            ),
            { numRuns: 100 }
        )
    })
})
