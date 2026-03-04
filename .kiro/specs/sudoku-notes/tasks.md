# Implementation Plan: Sudoku Notes (Pencil Marks)

## Overview

Add pencil marks (notes) to the Sudoku client. All changes are client-side: a new `notes-utils.ts` module with pure functions, a `NotesBoard` type, and modifications to Grid, NumberPad, and App components. Implementation follows strict TDD — write failing tests first, then minimal implementation, then refactor. Property-based tests use `fast-check` to verify the 8 correctness properties from the design document.

Build order: types → pure utility functions (with tests) → component modifications → integration wiring.

## Tasks

- [x] 1. Add NotesBoard type and create notes utility module (TDD)
  - [x] 1.1 Add `NotesBoard` type to `src/client/lib/types.ts`
    - Import `SvelteSet` from `svelte/reactivity`
    - Add `export type NotesBoard = SvelteSet<number>[][]`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Write unit tests for `getPeers`
    - Create `src/client/lib/__tests__/notes-utils.test.ts`
    - Test: returns exactly 20 coordinates for any valid cell
    - Test: does not include the cell itself
    - Test: no duplicate coordinates in result
    - Test: all returned coords share row, column, or 3×3 box with input
    - Test: corner cell (0,0), center cell (4,4), edge cell (0,4), box boundary cell (2,3)
    - Tests must fail initially (Red phase)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.3 Implement `getPeers` in `src/client/lib/notes-utils.ts`
    - Create `src/client/lib/notes-utils.ts`
    - Define `CellCoord = readonly [row: number, col: number]`
    - Implement `getPeers(row: number, col: number): CellCoord[]` per design algorithm
    - Row peers (8) + column peers (8) + box-only peers (4) = 20 total
    - Run `bun run test` — all 1.2 tests must pass (Green phase)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.4 Write unit tests for `createEmptyNotesBoard`, `toggleNote`, `clearCellNotes`, `cleanupNotes`
    - Add to `src/client/lib/__tests__/notes-utils.test.ts`
    - Test `createEmptyNotesBoard`: returns 9×9 array, each cell is empty SvelteSet, sets are independent instances
    - Test `toggleNote`: adds digit if absent, removes digit if present, double-toggle restores original
    - Test `toggleNote`: only modifies targeted cell, other cells unchanged
    - Test `clearCellNotes`: empties the cell's note set regardless of contents
    - Test `cleanupNotes`: removes digit from all peer cells' notes, non-peer cells unchanged
    - Tests must fail initially (Red phase)
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.5, 5.1, 5.2, 5.3_

  - [x] 1.5 Implement `createEmptyNotesBoard`, `toggleNote`, `clearCellNotes`, `cleanupNotes`
    - Add to `src/client/lib/notes-utils.ts`
    - `createEmptyNotesBoard(): NotesBoard` — 9×9 array of independent `SvelteSet<number>`
    - `toggleNote(notesBoard, row, col, digit): void` — add if absent, delete if present
    - `clearCellNotes(notesBoard, row, col): void` — clear the set
    - `cleanupNotes(notesBoard, row, col, digit): void` — delete digit from all peer sets
    - Run `bun run test` — all 1.4 tests must pass (Green phase)
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.5, 5.1, 5.2, 5.3_

- [x] 2. Write property-based tests for notes utilities (Properties 1–7)
  - [x] 2.1 Write property test: createEmptyNotesBoard produces independent sets (Property 1)
    - Create `src/client/lib/__tests__/notes-utils.property.test.ts`
    - Use `fast-check` with minimum 100 iterations
    - **Property 1: createEmptyNotesBoard produces independent sets**
    - Generate two distinct random cell positions, mutate one set, verify the other is unchanged
    - **Validates: Requirement 1.2**

  - [x] 2.2 Write property test: toggleNote is self-inverse (Property 2)
    - **Property 2: toggleNote is self-inverse**
    - For any cell and digit 1–9, calling toggleNote twice restores original state
    - **Validates: Requirement 3.1**

  - [x] 2.3 Write property test: toggleNote only modifies targeted cell (Property 3)
    - **Property 3: toggleNote only modifies the targeted cell**
    - For any cell and digit, all other cells' note sets remain unchanged after toggleNote
    - **Validates: Requirements 3.2, 1.2**

  - [x] 2.4 Write property test: clearCellNotes empties the note set (Property 4)
    - **Property 4: clearCellNotes empties the note set**
    - For any cell with any notes, clearCellNotes results in an empty set
    - **Validates: Requirements 5.1, 9.1**

  - [x] 2.5 Write property test: cleanupNotes removes digit from exactly peer cells (Property 5)
    - **Property 5: cleanupNotes removes digit from exactly peer cells**
    - After cleanup, no peer has the digit; all non-peer notes are unchanged
    - **Validates: Requirements 5.2, 5.3**

  - [x] 2.6 Write property test: getPeers returns exactly 20 unique coordinates (Property 6)
    - **Property 6: getPeers returns exactly 20 unique coordinates**
    - For any valid (row, col), result has length 20 with no duplicates
    - **Validates: Requirements 6.1, 6.4**

  - [x] 2.7 Write property test: getPeers returns correct peer membership (Property 7)
    - **Property 7: getPeers returns correct peer membership**
    - Self not included; every returned coord shares row, col, or box; every valid peer is present
    - **Validates: Requirements 6.2, 6.3**

- [x] 3. Checkpoint — Verify notes utilities
  - Ensure all tests pass, ask the user if questions arise.
  - Run `bun run test && bun run type-check`, confirm zero failures.

- [x] 4. Modify NumberPad component with notes toggle
  - [x] 4.1 Add notes toggle button to `src/client/components/NumberPad.svelte`
    - Add new props: `notesMode: boolean`, `onToggleNotes: () => void`
    - Render pencil icon (✏️) toggle button with active/inactive visual state
    - Active state: distinct background color (e.g. `bg-blue-500 text-white`)
    - Inactive state: default button styling
    - Minimum 44px touch target
    - Support light/dark mode via Tailwind `dark:` variants
    - _Requirements: 2.1, 2.3_

- [x] 5. Modify Grid component with notes rendering and highlighting
  - [x] 5.1 Add notes mini-grid rendering to `src/client/components/Grid.svelte`
    - Add new props: `notesBoard: NotesBoard`, `highlightDigit: number | null`
    - When cell has value > 0: render value only (no notes)
    - When cell has value 0 and notes: render 3×3 CSS mini-grid with digits 1–9 in positional slots
    - Position each digit in its slot: 1=top-left, 2=top-center, ..., 9=bottom-right
    - Scale note font: `text-[0.5rem] sm:text-[0.6rem]`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 5.2 Add highlight styling for value and note matches
    - When `highlightDigit` is set and cell value matches: apply `bg-blue-100 dark:bg-blue-900/30`
    - When `highlightDigit` is set and cell notes contain the digit: apply `bg-yellow-100 dark:bg-yellow-900/30`
    - Matching note digit within mini-grid: `text-blue-600 font-bold`
    - Ensure highlight styles adapt to light/dark mode
    - _Requirements: 8.3, 8.4, 8.5, 8.6_

- [x] 6. Wire notes state and input routing in App.svelte
  - [x] 6.1 Add notes state and mode toggle to `src/client/App.svelte`
    - Add state: `notesMode = $state(false)`, `notesBoard = $state(createEmptyNotesBoard())`
    - Add derived: `highlightDigit` from selected cell's value (non-zero → value, else null)
    - Pass `notesMode` and `onToggleNotes` to NumberPad
    - Pass `notesBoard` and `highlightDigit` to Grid
    - Reset `notesBoard` and `notesMode` when starting a new puzzle
    - _Requirements: 1.1, 1.3, 2.2, 8.1, 8.2_

  - [x] 6.2 Implement number input routing based on notes mode
    - When `notesMode` is false: place value as existing behavior, then call `clearCellNotes` + `cleanupNotes`
    - When `notesMode` is true: call `toggleNote` instead of placing value
    - Guard: ignore if no cell selected, cell is given, or (for notes) cell has non-zero value
    - _Requirements: 2.4, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3_

  - [x] 6.3 Implement Shift+digit keyboard shortcut for notes
    - In keyboard handler: detect Shift+digit (1–9)
    - Toggle note on selected cell regardless of current `notesMode`
    - Guard: ignore if no cell selected, cell is given, cell has non-zero value
    - _Requirements: 4.1, 4.2_

  - [x] 6.4 Implement erase behavior in notes mode
    - When `notesMode` is true and erase pressed: call `clearCellNotes` on selected cell
    - When `notesMode` is false and erase pressed: existing erase behavior (clear value)
    - Guard: ignore if no cell selected or cell is given
    - _Requirements: 9.1, 9.2_

  - [x] 6.5 Handle value erasure — do not restore notes
    - When erasing a cell's value (normal mode), do not restore any previously removed notes
    - Notes removed by auto-cleanup are permanently gone
    - _Requirements: 5.4_

- [x] 7. Write property test for highlight digit derivation (Property 8)
  - [x] 7.1 Write property test: highlight digit derivation (Property 8)
    - Add to `src/client/lib/__tests__/notes-utils.property.test.ts`
    - **Property 8: Highlight digit derivation**
    - For any board state and selection, highlightDigit equals selected cell's value when non-zero, null otherwise
    - **Validates: Requirements 8.1, 8.2**

- [x] 8. Final checkpoint — Full verification
  - Run `bun run test && bun run type-check && bun run check` to verify everything compiles and all tests pass.
  - Ensure all components are wired together with no orphaned code.
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All unit tests in task 1 are required — tests must be written before implementation per TDD workflow
- Property tests (task 2, 7) are optional but recommended for correctness confidence
- No server changes needed — all work is client-side
- `SvelteSet` from `svelte/reactivity` provides fine-grained reactivity for note mutations
- Svelte component modifications (tasks 4–6) skip test files — use `svelte-autofixer` instead
- Each task references specific requirements for traceability
- Checkpoints gate on `bun run test && bun run type-check` — zero failures required
