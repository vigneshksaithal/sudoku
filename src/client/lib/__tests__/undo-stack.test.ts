import { describe, expect, test } from 'vitest'
import { SvelteSet } from 'svelte/reactivity'

import {
    pushSnapshot,
    popSnapshot,
    clearStack,
    captureSnapshot,
    restoreNotesBoard,
    MAX_UNDO,
} from '../undo-stack'
import type { Snapshot, UndoStack } from '../undo-stack'
import type { CellState, NotesBoard } from '../types'

// --- Helpers ---

const makeBoard = (): CellState[][] =>
    Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => ({
            value: (r * 9 + c) % 10,
            isGiven: false,
            hasConflict: false,
        }))
    )

const makeNotesBoard = (): NotesBoard =>
    Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new SvelteSet<number>([1, 2, 3]))
    )

const makeSnapshot = (hintsUsed = 0): Snapshot => ({
    board: makeBoard(),
    notes: Array.from({ length: 9 }, () =>
        Array.from({ length: 9 }, () => new Set<number>([1, 2, 3]))
    ),
    hintsUsed,
})

// --- pushSnapshot ---

describe('pushSnapshot', () => {
    test('stack grows by 1 when pushing onto empty stack', () => {
        const stack: UndoStack = []
        const snapshot = makeSnapshot()
        const result = pushSnapshot(stack, snapshot)
        expect(result).toHaveLength(1)
    })

    test('top entry matches the pushed snapshot', () => {
        const stack: UndoStack = []
        const snapshot = makeSnapshot(3)
        const result = pushSnapshot(stack, snapshot)
        expect(result[result.length - 1]).toBe(snapshot)
    })

    test('stack grows by 1 when pushing onto non-empty stack', () => {
        const stack: UndoStack = [makeSnapshot(), makeSnapshot()]
        const snapshot = makeSnapshot()
        const result = pushSnapshot(stack, snapshot)
        expect(result).toHaveLength(3)
    })

    test('does not mutate the original stack', () => {
        const stack: UndoStack = [makeSnapshot()]
        pushSnapshot(stack, makeSnapshot())
        expect(stack).toHaveLength(1)
    })

    test('cap enforced — length never exceeds MAX_UNDO', () => {
        let stack: UndoStack = []
        for (let i = 0; i < MAX_UNDO + 10; i++) {
            stack = pushSnapshot(stack, makeSnapshot(i))
        }
        expect(stack.length).toBeLessThanOrEqual(MAX_UNDO)
        expect(stack).toHaveLength(MAX_UNDO)
    })

    test('oldest entry is discarded when cap is exceeded', () => {
        let stack: UndoStack = []
        // Push MAX_UNDO snapshots with hintsUsed = index
        for (let i = 0; i < MAX_UNDO; i++) {
            stack = pushSnapshot(stack, makeSnapshot(i))
        }
        // Push one more — oldest (hintsUsed=0) should be gone
        const newest = makeSnapshot(MAX_UNDO)
        stack = pushSnapshot(stack, newest)

        expect(stack).toHaveLength(MAX_UNDO)
        expect(stack[0]!.hintsUsed).toBe(1) // oldest (0) discarded
        expect(stack[stack.length - 1]).toBe(newest)
    })
})

// --- popSnapshot ---

describe('popSnapshot', () => {
    test('returns [null, stack] on empty stack', () => {
        const stack: UndoStack = []
        const [snapshot, newStack] = popSnapshot(stack)
        expect(snapshot).toBeNull()
        expect(newStack).toEqual([])
    })

    test('returns the last snapshot from a single-entry stack', () => {
        const s = makeSnapshot(7)
        const stack: UndoStack = [s]
        const [snapshot, newStack] = popSnapshot(stack)
        expect(snapshot).toBe(s)
        expect(newStack).toHaveLength(0)
    })

    test('returns the last snapshot from a multi-entry stack', () => {
        const s1 = makeSnapshot(1)
        const s2 = makeSnapshot(2)
        const s3 = makeSnapshot(3)
        const stack: UndoStack = [s1, s2, s3]
        const [snapshot, newStack] = popSnapshot(stack)
        expect(snapshot).toBe(s3)
        expect(newStack).toHaveLength(2)
        expect(newStack[0]).toBe(s1)
        expect(newStack[1]).toBe(s2)
    })

    test('returned stack is one shorter than input', () => {
        const stack: UndoStack = [makeSnapshot(), makeSnapshot(), makeSnapshot()]
        const [, newStack] = popSnapshot(stack)
        expect(newStack).toHaveLength(stack.length - 1)
    })

    test('does not mutate the original stack', () => {
        const stack: UndoStack = [makeSnapshot(), makeSnapshot()]
        popSnapshot(stack)
        expect(stack).toHaveLength(2)
    })
})

// --- clearStack ---

describe('clearStack', () => {
    test('returns empty array', () => {
        expect(clearStack()).toEqual([])
    })

    test('always returns [] regardless of prior state', () => {
        // clearStack takes no arguments — just verify it always returns []
        expect(clearStack()).toHaveLength(0)
        expect(clearStack()).toHaveLength(0)
    })
})

// --- captureSnapshot ---

describe('captureSnapshot', () => {
    test('returned snapshot contains correct hintsUsed', () => {
        const board = makeBoard()
        const notesBoard = makeNotesBoard()
        const snapshot = captureSnapshot(board, notesBoard, 5)
        expect(snapshot.hintsUsed).toBe(5)
    })

    test('mutating original board does not affect snapshot (deep copy)', () => {
        const board = makeBoard()
        const notesBoard = makeNotesBoard()
        const snapshot = captureSnapshot(board, notesBoard, 0)

        const originalValue = snapshot.board[0]![0]!.value
        board[0]![0] = { value: 99, isGiven: true, hasConflict: true }

        expect(snapshot.board[0]![0]!.value).toBe(originalValue)
    })

    test('mutating original notesBoard does not affect snapshot (deep copy)', () => {
        const board = makeBoard()
        const notesBoard = makeNotesBoard()
        const snapshot = captureSnapshot(board, notesBoard, 0)

        // Snapshot notes should be plain Sets
        const originalSize = snapshot.notes[0]![0]!.size
        notesBoard[0]![0]!.add(9)

        expect(snapshot.notes[0]![0]!.size).toBe(originalSize)
    })

    test('snapshot notes are Set instances (SvelteSet === Set in this Svelte version)', () => {
        const board = makeBoard()
        const notesBoard = makeNotesBoard()
        const snapshot = captureSnapshot(board, notesBoard, 0)

        // SvelteSet === Set in Svelte 5 (same reference), so we verify it's a Set
        // and that it's a distinct copy (not the same reference as the original)
        expect(snapshot.notes[0]![0]).toBeInstanceOf(Set)
        expect(snapshot.notes[0]![0]).not.toBe(notesBoard[0]![0])
    })

    test('snapshot board values match original board at capture time', () => {
        const board = makeBoard()
        const notesBoard = makeNotesBoard()
        const snapshot = captureSnapshot(board, notesBoard, 0)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(snapshot.board[r]![c]).toEqual(board[r]![c])
            }
        }
    })
})

// --- restoreNotesBoard ---

describe('restoreNotesBoard', () => {
    test('reconstructed board has same digit sets as the plain-Set snapshot', () => {
        const notes: Set<number>[][] = Array.from({ length: 9 }, (_, r) =>
            Array.from({ length: 9 }, (_, c) => new Set<number>([r + 1, c + 1]))
        )
        const restored = restoreNotesBoard(notes)

        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const original = notes[r]![c]!
                const cell = restored[r]![c]!
                expect(cell.size).toBe(original.size)
                for (const digit of original) {
                    expect(cell.has(digit)).toBe(true)
                }
            }
        }
    })

    test('returns SvelteSet instances', () => {
        const notes: Set<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>([1]))
        )
        const restored = restoreNotesBoard(notes)
        expect(restored[0]![0]).toBeInstanceOf(SvelteSet)
    })

    test('empty sets are preserved', () => {
        const notes: Set<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>())
        )
        const restored = restoreNotesBoard(notes)
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                expect(restored[r]![c]!.size).toBe(0)
            }
        }
    })

    test('result is 9x9 grid', () => {
        const notes: Set<number>[][] = Array.from({ length: 9 }, () =>
            Array.from({ length: 9 }, () => new Set<number>())
        )
        const restored = restoreNotesBoard(notes)
        expect(restored).toHaveLength(9)
        for (const row of restored) {
            expect(row).toHaveLength(9)
        }
    })
})
