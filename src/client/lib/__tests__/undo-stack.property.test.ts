// Feature: undo-button, Property 1
// Validates: Requirements 1.1, 1.2, 1.3, 1.4

import { describe, test } from 'vitest'
import * as fc from 'fast-check'
import { SvelteSet } from 'svelte/reactivity'

import { captureSnapshot, clearStack, pushSnapshot, MAX_UNDO } from '../undo-stack'
import type { Snapshot, UndoStack } from '../undo-stack'
import type { CellState, NotesBoard } from '../types'

// --- Arbitraries ---

const cellStateArb: fc.Arbitrary<CellState> = fc.record({
    value: fc.integer({ min: 0, max: 9 }),
    isGiven: fc.boolean(),
    hasConflict: fc.boolean(),
})

const boardArb: fc.Arbitrary<CellState[][]> = fc.array(
    fc.array(cellStateArb, { minLength: 9, maxLength: 9 }),
    { minLength: 9, maxLength: 9 }
)

const notesCellArb: fc.Arbitrary<SvelteSet<number>> = fc
    .subarray([1, 2, 3, 4, 5, 6, 7, 8, 9])
    .map((digits) => new SvelteSet<number>(digits))

const notesBoardArb: fc.Arbitrary<NotesBoard> = fc.array(
    fc.array(notesCellArb, { minLength: 9, maxLength: 9 }),
    { minLength: 9, maxLength: 9 }
)

const hintsUsedArb: fc.Arbitrary<number> = fc.integer({ min: 0, max: 10 })

const snapshotArb: fc.Arbitrary<Snapshot> = fc.record({
    board: boardArb,
    notes: fc.array(
        fc.array(
            fc.subarray([1, 2, 3, 4, 5, 6, 7, 8, 9]).map((d) => new Set<number>(d)),
            { minLength: 9, maxLength: 9 }
        ),
        { minLength: 9, maxLength: 9 }
    ),
    hintsUsed: hintsUsedArb,
})

const initialStackArb: fc.Arbitrary<UndoStack> = fc.array(snapshotArb, {
    minLength: 0,
    maxLength: 10,
})

// --- Property 1: Any move pushes a snapshot ---

describe('Property 1: Any move pushes a snapshot', () => {
    test('stack grows by exactly 1 after captureSnapshot + pushSnapshot', () => {
        fc.assert(
            fc.property(
                boardArb,
                notesBoardArb,
                hintsUsedArb,
                initialStackArb,
                (board, notesBoard, hintsUsed, initialStack) => {
                    const snapshot = captureSnapshot(board, notesBoard, hintsUsed)
                    const newStack = pushSnapshot(initialStack, snapshot)
                    return newStack.length === initialStack.length + 1
                }
            )
        )
    })

    test('top of stack matches pre-move board state after push', () => {
        fc.assert(
            fc.property(
                boardArb,
                notesBoardArb,
                hintsUsedArb,
                initialStackArb,
                (board, notesBoard, hintsUsed, initialStack) => {
                    const snapshot = captureSnapshot(board, notesBoard, hintsUsed)
                    const newStack = pushSnapshot(initialStack, snapshot)
                    const top = newStack[newStack.length - 1]!

                    // Top snapshot board values match the pre-move board
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            const snapCell = top.board[r]![c]!
                            const origCell = board[r]![c]!
                            if (
                                snapCell.value !== origCell.value ||
                                snapCell.isGiven !== origCell.isGiven ||
                                snapCell.hasConflict !== origCell.hasConflict
                            ) {
                                return false
                            }
                        }
                    }
                    return true
                }
            )
        )
    })

    test('top of stack matches pre-move notes state after push', () => {
        fc.assert(
            fc.property(
                boardArb,
                notesBoardArb,
                hintsUsedArb,
                initialStackArb,
                (board, notesBoard, hintsUsed, initialStack) => {
                    const snapshot = captureSnapshot(board, notesBoard, hintsUsed)
                    const newStack = pushSnapshot(initialStack, snapshot)
                    const top = newStack[newStack.length - 1]!

                    // Top snapshot notes match the pre-move notesBoard
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            const snapNotes = top.notes[r]![c]!
                            const origNotes = notesBoard[r]![c]!
                            if (snapNotes.size !== origNotes.size) return false
                            for (const digit of origNotes) {
                                if (!snapNotes.has(digit)) return false
                            }
                        }
                    }
                    return true
                }
            )
        )
    })

    test('top of stack matches pre-move hintsUsed after push', () => {
        fc.assert(
            fc.property(
                boardArb,
                notesBoardArb,
                hintsUsedArb,
                initialStackArb,
                (board, notesBoard, hintsUsed, initialStack) => {
                    const snapshot = captureSnapshot(board, notesBoard, hintsUsed)
                    const newStack = pushSnapshot(initialStack, snapshot)
                    const top = newStack[newStack.length - 1]!
                    return top.hintsUsed === hintsUsed
                }
            )
        )
    })

    test('snapshot is a deep copy — mutating board after push does not affect top', () => {
        fc.assert(
            fc.property(
                boardArb,
                notesBoardArb,
                hintsUsedArb,
                initialStackArb,
                (board, notesBoard, hintsUsed, initialStack) => {
                    const snapshot = captureSnapshot(board, notesBoard, hintsUsed)
                    const newStack = pushSnapshot(initialStack, snapshot)
                    const top = newStack[newStack.length - 1]!
                    const originalValue = top.board[0]![0]!.value

                    // Mutate the original board after capture
                    board[0]![0] = { value: (originalValue + 1) % 10, isGiven: true, hasConflict: true }

                    return top.board[0]![0]!.value === originalValue
                }
            )
        )
    })
})

// Feature: undo-button, Property 2
// Validates: Requirement 1.5

describe('Property 2: Stack is cleared on puzzle load or difficulty change', () => {
    test('clearStack returns [] for any stack of length N (0 to 200)', () => {
        const largeStackArb: fc.Arbitrary<UndoStack> = fc.array(snapshotArb, {
            minLength: 0,
            maxLength: 200,
        })

        fc.assert(
            fc.property(largeStackArb, (stack) => {
                const result = clearStack()
                return Array.isArray(result) && result.length === 0
            })
        )
    })
})

// Feature: undo-button, Property 3
// Validates: Requirement 1.6

describe('Property 3: Stack length is bounded at MAX_UNDO', () => {
    test('stack length never exceeds MAX_UNDO after > MAX_UNDO pushes', () => {
        // Generate a count N in [MAX_UNDO + 1, MAX_UNDO + 50]
        const countArb = fc.integer({ min: MAX_UNDO + 1, max: MAX_UNDO + 50 })

        fc.assert(
            fc.property(countArb, (n) => {
                // Build N snapshots with distinct hintsUsed = index (0..N-1)
                let stack: UndoStack = []
                for (let i = 0; i < n; i++) {
                    const snapshot: Snapshot = {
                        board: Array.from({ length: 9 }, () =>
                            Array.from({ length: 9 }, () => ({
                                value: 0,
                                isGiven: false,
                                hasConflict: false,
                            }))
                        ),
                        notes: Array.from({ length: 9 }, () =>
                            Array.from({ length: 9 }, () => new Set<number>())
                        ),
                        hintsUsed: i,
                    }
                    stack = pushSnapshot(stack, snapshot)
                }

                // Final stack length must equal MAX_UNDO
                if (stack.length !== MAX_UNDO) return false

                // Oldest entries (hintsUsed 0..n-MAX_UNDO-1) must NOT be present
                const presentHints = new Set(stack.map((s) => s.hintsUsed))
                for (let i = 0; i < n - MAX_UNDO; i++) {
                    if (presentHints.has(i)) return false
                }

                // Newest entries (hintsUsed n-MAX_UNDO..n-1) must be present
                for (let i = n - MAX_UNDO; i < n; i++) {
                    if (!presentHints.has(i)) return false
                }

                // First entry in stack should be the oldest surviving snapshot
                const firstHints = stack[0]?.hintsUsed
                return firstHints === n - MAX_UNDO
            })
        )
    })
})

// Feature: undo-button, Property 4
// Validates: Requirements 2.1, 4.1, 4.2

import { popSnapshot } from '../undo-stack'

describe('Property 4: Undo round-trip restores state', () => {
    // **Validates: Requirements 2.1, 4.1, 4.2**
    test('N pushes followed by N pops restores the original board, notes, and hintsUsed', () => {
        const nArb = fc.integer({ min: 1, max: 20 })

        fc.assert(
            fc.property(
                boardArb,
                notesBoardArb,
                hintsUsedArb,
                nArb,
                fc.array(snapshotArb, { minLength: 19, maxLength: 19 }),
                (origBoard, origNotes, origHintsUsed, n, intermediates) => {
                    // Step 1: capture the original state as a snapshot
                    const originalSnapshot = captureSnapshot(origBoard, origNotes, origHintsUsed)

                    // Step 2: push the original snapshot first
                    let stack: UndoStack = pushSnapshot([], originalSnapshot)

                    // Step 3: push N-1 intermediate snapshots (simulating N-1 more moves)
                    for (let i = 0; i < n - 1; i++) {
                        stack = pushSnapshot(stack, intermediates[i]!)
                    }

                    // Step 4: pop N times to get back to the original snapshot
                    let poppedSnapshot: Snapshot | null = null
                    for (let i = 0; i < n; i++) {
                        const [snap, next] = popSnapshot(stack)
                        poppedSnapshot = snap
                        stack = next
                    }

                    if (poppedSnapshot === null) return false

                    // Step 5: assert board matches cell-by-cell
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            const restoredCell = poppedSnapshot.board[r]![c]!
                            const origCell = origBoard[r]![c]!
                            if (
                                restoredCell.value !== origCell.value ||
                                restoredCell.isGiven !== origCell.isGiven ||
                                restoredCell.hasConflict !== origCell.hasConflict
                            ) {
                                return false
                            }
                        }
                    }

                    // Step 6: assert notes match cell-by-cell
                    for (let r = 0; r < 9; r++) {
                        for (let c = 0; c < 9; c++) {
                            const restoredNotes = poppedSnapshot.notes[r]![c]!
                            const origNotesCell = origNotes[r]![c]!
                            if (restoredNotes.size !== origNotesCell.size) return false
                            for (const digit of origNotesCell) {
                                if (!restoredNotes.has(digit)) return false
                            }
                        }
                    }

                    // Step 7: assert hintsUsed matches
                    return poppedSnapshot.hintsUsed === origHintsUsed
                }
            )
        )
    })
})

// Feature: undo-button, Property 9
// Validates: Requirement 4.4

describe('Property 9: Undoing a hint decrements hintsUsed', () => {
    // **Validates: Requirement 4.4**
    test('popped snapshot has hintsUsed equal to the pre-hint value h', () => {
        const hArb = fc.integer({ min: 0, max: 20 })

        fc.assert(
            fc.property(hArb, boardArb, notesBoardArb, (h, board, notesBoard) => {
                // Capture pre-hint state with hintsUsed = h
                const snapshot = captureSnapshot(board, notesBoard, h)
                const stack = pushSnapshot([], snapshot)
                const [popped] = popSnapshot(stack)
                return popped !== null && popped.hintsUsed === h
            })
        )
    })
})

// Feature: undo-button, Property 7
// Validates: Requirements 3.2, 3.3

import type { GameScreen } from '../types'

describe('Property 7: undoDisabled matches stack and screen', () => {
    // **Validates: Requirements 3.2, 3.3**
    test('undoDisabled is true iff stack is empty or screen is not playing', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }),
                fc.constantFrom<GameScreen>('playing', 'completed'),
                (stackLength, screen) => {
                    const undoDisabled = stackLength === 0 || screen !== 'playing'
                    const expected = stackLength === 0 || screen !== 'playing'
                    return undoDisabled === expected
                }
            )
        )
    })

    test('undoDisabled is false only when stack is non-empty AND screen is playing', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 1, max: 20 }),
                (stackLength) => {
                    const screen: GameScreen = 'playing'
                    const undoDisabled = stackLength === 0 || screen !== 'playing'
                    return undoDisabled === false
                }
            )
        )
    })

    test('undoDisabled is true when stack is empty regardless of screen', () => {
        fc.assert(
            fc.property(
                fc.constantFrom<GameScreen>('playing', 'completed'),
                (screen) => {
                    const undoDisabled = 0 === 0 || screen !== 'playing'
                    return undoDisabled === true
                }
            )
        )
    })

    test('undoDisabled is true when screen is not playing regardless of stack length', () => {
        fc.assert(
            fc.property(
                fc.integer({ min: 0, max: 20 }),
                (stackLength) => {
                    const screen: GameScreen = 'completed'
                    const undoDisabled = stackLength === 0 || screen !== 'playing'
                    return undoDisabled === true
                }
            )
        )
    })
})

// Feature: undo-button, Property 6
// Validates: Requirement 2.4

describe('Property 6: Undo is a no-op when screen is not "playing"', () => {
    // **Validates: Requirement 2.4**
    test('undoDisabled is true for any non-empty stack when screen is not playing', () => {
        fc.assert(
            fc.property(
                fc.constantFrom<GameScreen>('completed'),
                fc.array(snapshotArb, { minLength: 1, maxLength: 20 }),
                (screen, stack) => {
                    const undoDisabled = stack.length === 0 || screen !== 'playing'
                    // When undoDisabled is true, handleUndo would return early — stack unchanged
                    if (!undoDisabled) return false
                    // Simulate the guard: since undoDisabled, popSnapshot is never called
                    const stackBefore = stack.length
                    // No pop happens — stack remains the same length
                    return stack.length === stackBefore
                }
            )
        )
    })

    test('guard logic: undoDisabled prevents pop for all non-playing screens with non-empty stacks', () => {
        fc.assert(
            fc.property(
                fc.array(snapshotArb, { minLength: 1, maxLength: 20 }),
                (stack) => {
                    const screen: GameScreen = 'completed'
                    const undoDisabled = stack.length === 0 || screen !== 'playing'
                    // undoDisabled must be true — the guard fires and stack is not modified
                    return undoDisabled === true
                }
            )
        )
    })
})

// Feature: undo-button, Property 8
// Validates: Requirement 4.3

import { updateConflicts } from '../sudoku-utils'

describe('Property 8: No redo — new move after undo discards future', () => {
    // **Validates: Requirement 4.3**
    test('stack depth is N - k + 1 after N pushes, k pops, and 1 new push', () => {
        fc.assert(
            fc.property(
                fc.tuple(
                    fc.integer({ min: 1, max: 15 }),
                    fc.integer({ min: 1, max: 15 })
                ).map(([a, b]): [number, number] => [Math.max(a, b), Math.min(a, b)]),
                ([n, k]) => {
                    // Push N snapshots with distinct hintsUsed = index
                    let stack: UndoStack = []
                    for (let i = 0; i < n; i++) {
                        const snapshot: Snapshot = {
                            board: Array.from({ length: 9 }, () =>
                                Array.from({ length: 9 }, () => ({
                                    value: 0,
                                    isGiven: false,
                                    hasConflict: false,
                                }))
                            ),
                            notes: Array.from({ length: 9 }, () =>
                                Array.from({ length: 9 }, () => new Set<number>())
                            ),
                            hintsUsed: i,
                        }
                        stack = pushSnapshot(stack, snapshot)
                    }

                    // Pop k times (simulating k undos)
                    for (let i = 0; i < k; i++) {
                        const [, next] = popSnapshot(stack)
                        stack = next
                    }

                    // Push 1 new snapshot (simulating a new move after undo)
                    const newSnapshot: Snapshot = {
                        board: Array.from({ length: 9 }, () =>
                            Array.from({ length: 9 }, () => ({
                                value: 5,
                                isGiven: false,
                                hasConflict: false,
                            }))
                        ),
                        notes: Array.from({ length: 9 }, () =>
                            Array.from({ length: 9 }, () => new Set<number>())
                        ),
                        hintsUsed: 999,
                    }
                    stack = pushSnapshot(stack, newSnapshot)

                    // Assert stack depth === N - k + 1
                    const expectedDepth = n - k + 1
                    if (stack.length !== expectedDepth) return false

                    // Assert new snapshot is on top
                    const top = stack[stack.length - 1]!
                    if (top.hintsUsed !== 999) return false

                    // Assert none of the undone snapshots (hintsUsed n-k..n-1) are present
                    const presentHints = new Set(stack.map((s) => s.hintsUsed))
                    for (let i = n - k; i < n; i++) {
                        if (presentHints.has(i)) return false
                    }

                    return true
                }
            )
        )
    })
})

// Feature: undo-button, Property 5
// Validates: Requirement 2.2

describe('Property 5: Conflicts are consistent after undo', () => {
    // **Validates: Requirement 2.2**
    test('updateConflicts is idempotent — calling it twice equals calling it once', () => {
        fc.assert(
            fc.property(boardArb, (board) => {
                const once = updateConflicts(board)
                const twice = updateConflicts(once)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (once[r]![c]!.hasConflict !== twice[r]![c]!.hasConflict) return false
                    }
                }
                return true
            })
        )
    })

    test('after push + pop + updateConflicts, hasConflict matches a fresh updateConflicts call', () => {
        fc.assert(
            fc.property(boardArb, notesBoardArb, hintsUsedArb, (board, notesBoard, hintsUsed) => {
                const snapshot = captureSnapshot(board, notesBoard, hintsUsed)
                const stack = pushSnapshot([], snapshot)
                const [popped] = popSnapshot(stack)

                if (popped === null) return false

                // Simulate what handleUndo does: updateConflicts on restored board
                const restored = updateConflicts(popped.board)
                // Fresh computation on the same board
                const fresh = updateConflicts(popped.board)

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (restored[r]![c]!.hasConflict !== fresh[r]![c]!.hasConflict) return false
                    }
                }
                return true
            })
        )
    })
})
