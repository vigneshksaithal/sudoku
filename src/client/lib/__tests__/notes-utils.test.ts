import { describe, it, expect } from 'vitest'
import { SvelteSet } from 'svelte/reactivity'
import { getPeers, createEmptyNotesBoard, toggleNote, clearCellNotes, cleanupNotes } from '../notes-utils'
import type { CellCoord } from '../notes-utils'

// Helper: check if two coords are equal
const coordEq = (a: CellCoord, b: CellCoord): boolean => a[0] === b[0] && a[1] === b[1]

// Helper: check if a coord is in the result list
const hasCoord = (peers: CellCoord[], row: number, col: number): boolean =>
    peers.some((p) => p[0] === row && p[1] === col)

// Helper: check for duplicate coords
const hasDuplicates = (peers: CellCoord[]): boolean => {
    for (let i = 0; i < peers.length; i++) {
        for (let j = i + 1; j < peers.length; j++) {
            if (coordEq(peers[i]!, peers[j]!)) return true
        }
    }
    return false
}

// Helper: check if a coord shares row, col, or 3×3 box with (row, col)
const isPeer = (pRow: number, pCol: number, row: number, col: number): boolean => {
    if (pRow === row) return true
    if (pCol === col) return true
    const boxRow = Math.floor(row / 3) * 3
    const boxCol = Math.floor(col / 3) * 3
    return pRow >= boxRow && pRow < boxRow + 3 && pCol >= boxCol && pCol < boxCol + 3
}

describe('getPeers — count', () => {
    it('returns exactly 20 coordinates for corner cell (0,0)', () => {
        expect(getPeers(0, 0)).toHaveLength(20)
    })

    it('returns exactly 20 coordinates for center cell (4,4)', () => {
        expect(getPeers(4, 4)).toHaveLength(20)
    })

    it('returns exactly 20 coordinates for edge cell (0,4)', () => {
        expect(getPeers(0, 4)).toHaveLength(20)
    })

    it('returns exactly 20 coordinates for box boundary cell (2,3)', () => {
        expect(getPeers(2, 3)).toHaveLength(20)
    })
})

describe('getPeers — no self', () => {
    it('does not include (0,0) itself', () => {
        expect(hasCoord(getPeers(0, 0), 0, 0)).toBe(false)
    })

    it('does not include (4,4) itself', () => {
        expect(hasCoord(getPeers(4, 4), 4, 4)).toBe(false)
    })

    it('does not include (0,4) itself', () => {
        expect(hasCoord(getPeers(0, 4), 0, 4)).toBe(false)
    })

    it('does not include (2,3) itself', () => {
        expect(hasCoord(getPeers(2, 3), 2, 3)).toBe(false)
    })
})

describe('getPeers — no duplicates', () => {
    it('no duplicate coordinates for corner cell (0,0)', () => {
        expect(hasDuplicates(getPeers(0, 0))).toBe(false)
    })

    it('no duplicate coordinates for center cell (4,4)', () => {
        expect(hasDuplicates(getPeers(4, 4))).toBe(false)
    })

    it('no duplicate coordinates for edge cell (0,4)', () => {
        expect(hasDuplicates(getPeers(0, 4))).toBe(false)
    })

    it('no duplicate coordinates for box boundary cell (2,3)', () => {
        expect(hasDuplicates(getPeers(2, 3))).toBe(false)
    })
})

describe('getPeers — correct peer membership', () => {
    it('all returned coords for (0,0) share row, col, or box', () => {
        const peers = getPeers(0, 0)
        for (const [r, c] of peers) {
            expect(isPeer(r, c, 0, 0)).toBe(true)
        }
    })

    it('all returned coords for (4,4) share row, col, or box', () => {
        const peers = getPeers(4, 4)
        for (const [r, c] of peers) {
            expect(isPeer(r, c, 4, 4)).toBe(true)
        }
    })

    it('all returned coords for (0,4) share row, col, or box', () => {
        const peers = getPeers(0, 4)
        for (const [r, c] of peers) {
            expect(isPeer(r, c, 0, 4)).toBe(true)
        }
    })

    it('all returned coords for (2,3) share row, col, or box', () => {
        const peers = getPeers(2, 3)
        for (const [r, c] of peers) {
            expect(isPeer(r, c, 2, 3)).toBe(true)
        }
    })

    it('(0,0) peers include all 8 row-0 cells, all 8 col-0 cells, and 4 box-only cells', () => {
        const peers = getPeers(0, 0)
        // Row peers: (0,1)..(0,8)
        for (let c = 1; c <= 8; c++) expect(hasCoord(peers, 0, c)).toBe(true)
        // Col peers: (1,0)..(8,0)
        for (let r = 1; r <= 8; r++) expect(hasCoord(peers, r, 0)).toBe(true)
        // Box-only peers: (1,1),(1,2),(2,1),(2,2)
        expect(hasCoord(peers, 1, 1)).toBe(true)
        expect(hasCoord(peers, 1, 2)).toBe(true)
        expect(hasCoord(peers, 2, 1)).toBe(true)
        expect(hasCoord(peers, 2, 2)).toBe(true)
    })

    it('(4,4) peers include all 8 row-4 cells, all 8 col-4 cells, and 4 box-only cells', () => {
        const peers = getPeers(4, 4)
        // Row peers: (4,0)..(4,3),(4,5)..(4,8)
        for (let c = 0; c <= 8; c++) {
            if (c !== 4) expect(hasCoord(peers, 4, c)).toBe(true)
        }
        // Col peers: (0,4)..(3,4),(5,4)..(8,4)
        for (let r = 0; r <= 8; r++) {
            if (r !== 4) expect(hasCoord(peers, r, 4)).toBe(true)
        }
        // Box-only peers in box 4 (rows 3-5, cols 3-5) excluding row 4 and col 4
        expect(hasCoord(peers, 3, 3)).toBe(true)
        expect(hasCoord(peers, 3, 5)).toBe(true)
        expect(hasCoord(peers, 5, 3)).toBe(true)
        expect(hasCoord(peers, 5, 5)).toBe(true)
    })
})

describe('createEmptyNotesBoard — structure', () => {
    it('returns a 9-row array', () => {
        expect(createEmptyNotesBoard()).toHaveLength(9)
    })

    it('each row has 9 cells', () => {
        const board = createEmptyNotesBoard()
        for (const row of board) {
            expect(row).toHaveLength(9)
        }
    })

    it('each cell is an empty SvelteSet (size === 0)', () => {
        const board = createEmptyNotesBoard()
        for (const row of board) {
            for (const cell of row) {
                expect(cell).toBeInstanceOf(SvelteSet)
                expect(cell.size).toBe(0)
            }
        }
    })

    it('sets are independent instances — mutating one does not affect another', () => {
        const board = createEmptyNotesBoard()
        board[0]![0]!.add(5)
        expect(board[0]![1]!.size).toBe(0)
        expect(board[1]![0]!.size).toBe(0)
        expect(board[4]![4]!.size).toBe(0)
    })
})

describe('toggleNote — add/remove semantics', () => {
    it('adds digit if absent', () => {
        const board = createEmptyNotesBoard()
        toggleNote(board, 0, 0, 5)
        expect(board[0]![0]!.has(5)).toBe(true)
    })

    it('removes digit if present', () => {
        const board = createEmptyNotesBoard()
        toggleNote(board, 0, 0, 5)
        toggleNote(board, 0, 0, 5)
        expect(board[0]![0]!.has(5)).toBe(false)
    })

    it('double-toggle restores original empty state', () => {
        const board = createEmptyNotesBoard()
        toggleNote(board, 3, 3, 7)
        toggleNote(board, 3, 3, 7)
        expect(board[3]![3]!.size).toBe(0)
    })

    it('double-toggle restores original non-empty state', () => {
        const board = createEmptyNotesBoard()
        board[2]![4]!.add(1)
        board[2]![4]!.add(3)
        toggleNote(board, 2, 4, 9)
        toggleNote(board, 2, 4, 9)
        expect(board[2]![4]!.has(1)).toBe(true)
        expect(board[2]![4]!.has(3)).toBe(true)
        expect(board[2]![4]!.has(9)).toBe(false)
        expect(board[2]![4]!.size).toBe(2)
    })
})

describe('toggleNote — only modifies targeted cell', () => {
    it('all other cells remain unchanged after toggle', () => {
        const board = createEmptyNotesBoard()
        toggleNote(board, 4, 4, 3)
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (r === 4 && c === 4) continue
                expect(board[r]![c]!.size).toBe(0)
            }
        }
    })

    it('toggling (0,0) does not affect (0,1)', () => {
        const board = createEmptyNotesBoard()
        toggleNote(board, 0, 0, 1)
        expect(board[0]![1]!.has(1)).toBe(false)
    })
})

describe('clearCellNotes', () => {
    it('empties a cell that had notes', () => {
        const board = createEmptyNotesBoard()
        board[1]![2]!.add(3)
        board[1]![2]!.add(7)
        clearCellNotes(board, 1, 2)
        expect(board[1]![2]!.size).toBe(0)
    })

    it('is a no-op on an already empty cell', () => {
        const board = createEmptyNotesBoard()
        clearCellNotes(board, 5, 5)
        expect(board[5]![5]!.size).toBe(0)
    })

    it('does not affect other cells', () => {
        const board = createEmptyNotesBoard()
        board[0]![0]!.add(9)
        board[0]![1]!.add(9)
        clearCellNotes(board, 0, 0)
        expect(board[0]![1]!.has(9)).toBe(true)
    })
})

describe('cleanupNotes — removes digit from peer cells', () => {
    it('removes digit from all peer cells', () => {
        const board = createEmptyNotesBoard()
        const peers = getPeers(2, 2)
        // Add digit 4 to every peer
        for (const [r, c] of peers) {
            board[r]![c]!.add(4)
        }
        cleanupNotes(board, 2, 2, 4)
        for (const [r, c] of peers) {
            expect(board[r]![c]!.has(4)).toBe(false)
        }
    })

    it('does not modify non-peer cells', () => {
        const board = createEmptyNotesBoard()
        const peers = getPeers(0, 0)
        const peerSet = new Set(peers.map(([r, c]) => `${r},${c}`))

        // Add digit 6 to all cells
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                board[r]![c]!.add(6)
            }
        }

        cleanupNotes(board, 0, 0, 6)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (r === 0 && c === 0) continue // placed cell — not a peer
                if (peerSet.has(`${r},${c}`)) {
                    expect(board[r]![c]!.has(6)).toBe(false)
                } else {
                    expect(board[r]![c]!.has(6)).toBe(true)
                }
            }
        }
    })

    it('does not remove other digits from peer cells', () => {
        const board = createEmptyNotesBoard()
        const peers = getPeers(4, 4)
        for (const [r, c] of peers) {
            board[r]![c]!.add(1)
            board[r]![c]!.add(2)
        }
        cleanupNotes(board, 4, 4, 1)
        for (const [r, c] of peers) {
            expect(board[r]![c]!.has(2)).toBe(true)
        }
    })
})
