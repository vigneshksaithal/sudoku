# Implementation Plan: Undo Button

## Overview

Add a client-side undo stack to the Sudoku game. Build order: pure `undo-stack.ts` module (with tests) → `NumberPad.svelte` undo button → `App.svelte` wiring (state, snapshot pushes, handler, keyboard shortcut). All non-Svelte code follows strict TDD — write failing tests first, then minimal implementation.

## Tasks

- [x] 1. Implement `undo-stack.ts` pure module (TDD)
  - [x] 1.1 Write failing unit tests for `undo-stack.ts`
    - Create `src/client/lib/__tests__/undo-stack.test.ts`
    - Test `pushSnapshot`: stack grows by 1, top entry matches snapshot
    - Test `pushSnapshot`: cap enforced — length never exceeds MAX_UNDO, oldest entry discarded
    - Test `popSnapshot`: returns correct snapshot and a stack one shorter
    - Test `popSnapshot`: returns `[null, stack]` on empty stack
    - Test `clearStack`: always returns `[]`
    - Test `captureSnapshot`: returned snapshot is a deep copy (mutating original board/notes does not affect snapshot)
    - Test `restoreNotesBoard`: reconstructed board has same digit sets as the plain-Set snapshot
    - Tests must fail initially (Red phase)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1_

  - [x] 1.2 Implement `src/client/lib/undo-stack.ts`
    - Define `Snapshot` type: `{ board: CellState[][], notes: Set<number>[][], hintsUsed: number }`
    - Define `UndoStack = Snapshot[]` and `MAX_UNDO = 100`
    - Implement `pushSnapshot`: spread new snapshot onto end, slice to MAX_UNDO if over cap
    - Implement `popSnapshot`: return `[last, rest]` or `[null, stack]` if empty
    - Implement `clearStack`: return `[]`
    - Implement `captureSnapshot`: deep-copy board rows/cells and notes rows/sets
    - Implement `restoreNotesBoard`: map plain `Set<number>[][]` back to `SvelteSet<number>[][]`
    - Run `bun run test` — all 1.1 tests must pass (Green phase)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1_

  - [x] 1.3 Write property test: any move pushes a snapshot (Property 1)
    - Create `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate random board + notes state; call `captureSnapshot` then `pushSnapshot`; assert stack grows by 1 and top matches pre-move state
    - **Property 1: Any move pushes a snapshot**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [x] 1.4 Write property test: stack cleared on load/difficulty change (Property 2)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate stack of arbitrary length N; call `clearStack()`; assert result is `[]`
    - **Property 2: Stack is cleared on puzzle load or difficulty change**
    - **Validates: Requirement 1.5**

  - [x] 1.5 Write property test: stack length bounded at MAX_UNDO (Property 3)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate sequences of > MAX_UNDO pushes; assert `stack.length <= MAX_UNDO` at all times and oldest entries are discarded first
    - **Property 3: Stack length is bounded at MAX_UNDO**
    - **Validates: Requirement 1.6**

  - [x] 1.6 Write property test: N pushes + N pops restores original state (Property 4)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate random board/notes, push N snapshots, pop N times; assert final board and notes equal the original pre-push state
    - **Property 4: Undo round-trip restores state**
    - **Validates: Requirements 2.1, 4.1, 4.2**

  - [x] 1.7 Write property test: undoing a hint decrements hintsUsed (Property 9)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate snapshot with `hintsUsed = h`; push then pop; assert restored `hintsUsed === h`
    - **Property 9: Undoing a hint decrements hintsUsed**
    - **Validates: Requirement 4.4**

- [x] 2. Checkpoint — Verify undo-stack module
  - Ensure all tests pass, ask the user if questions arise.
  - Run `bun run test && bun run type-check`, confirm zero failures.

- [x] 3. Add undo button to `NumberPad.svelte`
  - Modify `src/client/components/NumberPad.svelte`
  - Add props: `onUndo: () => void`, `undoDisabled: boolean`
  - Expand the controls row to 3 columns to accommodate the new button
  - Render an `IconButton` with `aria-label="Undo last move"`, ↩ icon, `variant="default"`, and `disabled={undoDisabled}`
  - Apply muted/disabled styling when `undoDisabled` is true, consistent with existing disabled controls
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Wire undo state and handler in `App.svelte`
  - [x] 4.1 Add undo stack state and derived disabled flag
    - Add `let undoStack: UndoStack = $state([])` to `src/client/App.svelte`
    - Add `const undoDisabled = $derived(undoStack.length === 0 || screen !== 'playing')`
    - Import `UndoStack`, `pushSnapshot`, `popSnapshot`, `clearStack`, `captureSnapshot`, `restoreNotesBoard` from `./lib/undo-stack`
    - _Requirements: 1.5, 2.3, 2.4, 3.2, 3.3_

  - [x] 4.2 Implement `handleUndo` handler
    - Guard: return early if `undoDisabled`
    - Call `popSnapshot(undoStack)` → `[snapshot, next]`
    - Set `undoStack = next`, `board = updateConflicts(snapshot.board)`, `notesBoard = restoreNotesBoard(snapshot.notes)`, `hintsUsed = snapshot.hintsUsed`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.4_

  - [x] 4.3 Push snapshots before every mutating handler
    - In `handleNumber`: call `captureSnapshot` + `pushSnapshot` before applying the digit
    - In `handleErase`: call `captureSnapshot` + `pushSnapshot` before erasing
    - In `handleHint`: call `captureSnapshot` + `pushSnapshot` before applying the hint
    - In the notes path of `handleKeyDown` (and any auto-notes toggle): call `captureSnapshot` + `pushSnapshot` before toggling
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 4.4 Clear stack on puzzle load and difficulty change
    - In `fetchPuzzles` (new puzzle load): set `undoStack = clearStack()`
    - In `changeDifficulty`: set `undoStack = clearStack()`
    - _Requirements: 1.5_

  - [x] 4.5 Add Ctrl/Cmd+Z keyboard shortcut
    - In `handleKeyDown`, before other key checks: if `(e.ctrlKey || e.metaKey) && key === 'z'`, call `e.preventDefault()` then `handleUndo()` and return
    - _Requirements: 2.5_

  - [x] 4.6 Pass undo props to `NumberPad`
    - Pass `onUndo={handleUndo}` and `undoDisabled` to `<NumberPad>`
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 4.7 Write property test: undoDisabled matches stack and screen (Property 7)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate arbitrary stack lengths and screen values; assert `undoDisabled === (stack.length === 0 || screen !== 'playing')`
    - **Property 7: undoDisabled matches stack and screen**
    - **Validates: Requirements 3.2, 3.3**

  - [x] 4.8 Write property test: undo is no-op when screen is not "playing" (Property 6)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate non-playing screen values with non-empty stacks; assert `handleUndo` leaves board, notes, hintsUsed, and stack unchanged
    - **Property 6: Undo is a no-op when screen is not "playing"**
    - **Validates: Requirement 2.4**

  - [x] 4.9 Write property test: new move after undo discards future (Property 8)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Push N snapshots, pop k, push 1 new snapshot; assert stack depth is `(N - k + 1)` and no undone snapshots are present
    - **Property 8: No redo — new move after undo discards future**
    - **Validates: Requirement 4.3**

  - [x] 4.10 Write property test: conflicts consistent after undo (Property 5)
    - Add to `src/client/lib/__tests__/undo-stack.property.test.ts`
    - Generate arbitrary board states; after restoring via `popSnapshot` + `updateConflicts`, assert every cell's `hasConflict` equals the result of a fresh `updateConflicts` call
    - **Property 5: Conflicts are consistent after undo**
    - **Validates: Requirement 2.2**

- [x] 5. Final checkpoint — Full verification
  - Run `bun run test && bun run type-check && bun run check` to verify everything compiles and all tests pass.
  - Ensure all components are wired together with no orphaned code.
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- TDD is mandatory for all non-Svelte code: write failing tests first, then implement
- `NumberPad.svelte` modifications (task 3) and `App.svelte` wiring (task 4) skip test files — use `svelte-autofixer` instead
- `fast-check` is already installed — no new dependencies needed
- `SvelteSet` is a reactive wrapper; snapshots store plain `Set<number>[][]` to avoid reactivity entanglement
- `captureSnapshot` must deep-copy both board rows and notes sets — shallow copies will cause snapshot corruption
- Each task references specific requirements for traceability
