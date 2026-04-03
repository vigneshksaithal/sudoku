# Implementation Plan: Shift+Click Selection

## Overview

Add Shift+Click toggle selection to the Sudoku grid and batch digit placement for multi-selections in digit-first mode. Implementation proceeds bottom-up: pure utility functions first, then Grid.svelte integration, then App.svelte wiring with batch placement.

## Tasks

- [x] 1. Implement `toggleCellSelection` in selection-utils.ts
  - [x] 1.1 Add `toggleCellSelection` export to `src/client/lib/selection-utils.ts`
    - Accept `current: Selection`, `row: number`, `col: number`, return a new `Selection`
    - If selection is empty, return single-cell selection for the given cell
    - If cell is not in selection, add it and set focusCell to it
    - If cell is in selection and size > 1, remove it; reassign focusCell if it was the removed cell
    - If cell is the only selected cell, return selection unchanged
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 1.2 Write unit tests for `toggleCellSelection` in `src/client/lib/__tests__/selection-utils.test.ts`
    - Test empty selection → single-cell result
    - Test adding a cell to single-cell selection → two cells
    - Test removing a cell from two-cell selection → one cell
    - Test toggling the only selected cell → unchanged
    - Test removing focusCell → focusCell reassigned to remaining cell
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 1.3 Write property test for toggle-add (Property 1)
    - **Property 1: Toggle-add preserves existing cells and adds the new cell**
    - **Validates: Requirements 1.1, 1.4, 1.5, 3.1, 4.2, 4.5**

  - [ ]* 1.4 Write property test for toggle-remove (Property 2)
    - **Property 2: Toggle-remove removes only the target cell**
    - **Validates: Requirements 1.2, 1.6, 3.2, 4.3**

  - [ ]* 1.5 Write property test for single-cell minimum (Property 3)
    - **Property 3: Single-cell minimum guard**
    - **Validates: Requirements 1.3, 4.4**

  - [ ]* 1.6 Write property test for focusCell membership invariant extended with toggle (Property 4)
    - **Property 4: focusCell membership invariant (extended)**
    - Add `toggleCellSelection` as an operation in the existing Property 4 sequence test
    - **Validates: Requirements 4.6**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement `batchPlaceDigit` in app-logic.ts
  - [x] 3.1 Add `batchPlaceDigit` export to `src/client/lib/app-logic.ts`
    - Accept `board`, `notesBoard`, `selection`, `digit`; return list of placed `[row, col]` pairs
    - Iterate over `selection.cells`, skip given cells, place digit into non-given cells
    - Clear notes and clean up peer notes for each placed cell using existing `clearCellNotes` and `cleanupNotes`
    - Mutate `board` and `notesBoard` in place
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.2 Write unit tests for `batchPlaceDigit` in `src/client/lib/__tests__/app-logic.test.ts`
    - Test all given cells → no changes, returns empty array
    - Test mixed given/non-given → only non-given cells modified
    - Test cells with existing values → values overwritten
    - Test notes cleared and peer notes cleaned for placed cells
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.3 Write property test for batch placement targets (Property 5)
    - **Property 5: batchPlaceDigit targets exactly non-given cells in selection**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 3.4 Write property test for batch placement notes clearing (Property 6)
    - **Property 6: batchPlaceDigit clears placed cell notes**
    - **Validates: Requirements 6.4**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Wire Shift+Click into Grid.svelte
  - [x] 5.1 Add `onShiftCellSelect` prop to `src/client/components/Grid.svelte`
    - Add `onShiftCellSelect: (row: number, col: number) => void` to the props interface
    - _Requirements: 7.1_

  - [x] 5.2 Modify `handlePointerDown` in Grid.svelte to check `e.shiftKey`
    - When `e.shiftKey` is true: call `onShiftCellSelect(row, col)` and return early
    - When `e.shiftKey` is true: do NOT set `anchorCell`, do NOT set `isDragging`, do NOT call `setPointerCapture`
    - When `e.shiftKey` is false: existing drag behavior unchanged
    - _Requirements: 2.1, 2.2, 2.3, 5.1, 5.2, 7.1, 7.2, 8.1, 8.2_

- [x] 6. Wire handlers in App.svelte
  - [x] 6.1 Add `handleShiftCellSelect` handler in `src/client/App.svelte`
    - Import `toggleCellSelection` from selection-utils
    - Call `toggleCellSelection(selection, row, col)` and assign to `selection`
    - When `digitFirstMode && lockedDigit !== null && isMultiSelection(selection)`: push undo snapshot, then batch-place or apply auto-notes based on `notesMode`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.1, 3.2, 6.1, 6.5_

  - [x] 6.2 Pass `onShiftCellSelect={handleShiftCellSelect}` to Grid component in App.svelte
    - Wire the new prop on the `<Grid>` component
    - _Requirements: 7.1_

  - [x] 6.3 Modify `handleNumber` in App.svelte for batch placement on multi-selection
    - In digit-first mode, after locking a digit, check `isMultiSelection(selection)`
    - If multi-selection: push undo snapshot, call `batchPlaceDigit` (or `applyAutoNotes` in notes mode), update conflicts, check completion
    - Import `batchPlaceDigit` from app-logic
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code is TypeScript; test files use Vitest + fast-check (existing project dependencies)
