# Implementation Plan: Multi-Cell Selection

## Overview

Implement multi-cell selection for the Sudoku grid, replacing the single-cell `selectedRow`/`selectedCol` model with a Set-based `Selection` type. Pure selection logic lives in a new `selection-utils.ts` module. Grid.svelte switches from `onclick` to pointer events for drag support. App.svelte routes digit/erase input through multi-selection-aware logic (auto-notes when multi-selected). All selection functions are TDD'd with unit and property-based tests before implementation.

## Tasks

- [x] 1. Create selection-utils module with TDD
  - [x] 1.1 Write unit tests for selection-utils
    - Create `src/client/lib/__tests__/selection-utils.test.ts`
    - Test `cellKey` and `parseKey` round-trip encoding
    - Test `setSelection` returns single-cell selection with correct focusCell
    - Test `extendSelection` adds cell, preserves existing, updates focusCell
    - Test `extendSelection` with duplicate cell (idempotent)
    - Test `toggleSelection` adds when absent, removes when present, manages focusCell
    - Test `toggleSelection` removing the only cell yields empty selection with null focusCell
    - Test `clearSelection` returns EMPTY_SELECTION
    - Test `moveFocus` clamps to grid bounds at all four corners
    - Test `moveFocus` with null focusCell returns EMPTY_SELECTION
    - Test `isSelected` and `isMultiSelection`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 7.1, 7.2, 9.1_

  - [x] 1.2 Implement selection-utils
    - Create `src/client/lib/selection-utils.ts`
    - Implement `cellKey`, `parseKey`, `setSelection`, `extendSelection`, `toggleSelection`, `clearSelection`, `moveFocus`, `isSelected`, `isMultiSelection`, and `EMPTY_SELECTION` as per design
    - All functions are pure, return new Selection objects, use ReadonlySet
    - Import `CellCoord` from `notes-utils.ts`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 7.1, 7.2, 9.1_

  - [x] 1.3 Write property test: setSelection produces exclusive single-cell selection
    - Create `src/client/lib/__tests__/selection-utils.property.test.ts`
    - **Property 1: setSelection produces exclusive single-cell selection**
    - For any valid (row, col) in [0,8], `setSelection` returns cells.size === 1 and focusCell === [row, col]
    - **Validates: Requirements 1.1, 1.2**

  - [x] 1.4 Write property test: extendSelection adds cell and preserves existing cells
    - **Property 2: extendSelection adds cell and preserves existing cells**
    - For any valid Selection and (row, col), result cells is superset of original and contains new cell, focusCell === [row, col]
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.5 Write property test: toggleSelection is self-inverse
    - **Property 3: toggleSelection is self-inverse**
    - Calling toggleSelection twice with same cell restores original cells set
    - **Validates: Requirements 3.1**

  - [x] 1.6 Write property test: focusCell membership invariant
    - **Property 4: focusCell membership invariant**
    - For any Selection produced by setSelection/extendSelection/toggleSelection/moveFocus, if focusCell is not null it must be in cells; if cells is empty focusCell must be null
    - **Validates: Requirements 1.2, 2.2, 3.2, 3.3**

  - [x] 1.7 Write property test: moveFocus produces valid clamped single selection
    - **Property 5: moveFocus produces valid clamped single selection**
    - For any focusCell and delta (dr, dc) in {-1,0,1}, result is single-cell selection with row/col clamped to [0,8]
    - **Validates: Requirements 7.1, 7.2**

- [x] 2. Checkpoint - Ensure all selection-utils tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update App.svelte selection state and input routing
  - [x] 3.1 Replace selectedRow/selectedCol with Selection state in App.svelte
    - Import `Selection`, `EMPTY_SELECTION`, `setSelection`, `extendSelection`, `toggleSelection`, `clearSelection`, `moveFocus`, `isSelected`, `isMultiSelection`, `cellKey`, `parseKey` from selection-utils
    - Replace `let selectedRow` / `let selectedCol` with `let selection: Selection = $state(EMPTY_SELECTION)`
    - Update `highlightDigit` derived to use `selection.focusCell`
    - Update `selectDifficulty` and `backToPicking` to reset with `EMPTY_SELECTION`
    - Add `handleCellExtend` and `handleCellToggle` callbacks
    - Update `handleCellSelect` to use `setSelection`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Update handleNumber for multi-selection auto-notes
    - When `isMultiSelection(selection)`: iterate `selection.cells`, parse each key, skip given/filled cells, call `toggleNote` on each empty cell
    - When single selection: preserve existing behavior (value or note based on notesMode)
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 3.3 Update handleErase for multi-selection
    - When `isMultiSelection(selection)`: iterate `selection.cells`, parse each key, skip given cells, call `clearCellNotes` on each empty cell
    - When single selection: preserve existing behavior
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.4 Update handleKeyDown for arrow keys and Escape
    - Arrow keys: call `moveFocus(selection.focusCell, dr, dc)` and assign result to `selection`
    - Escape key: call `clearSelection()` and assign to `selection`
    - _Requirements: 7.1, 7.2, 9.1_

  - [x] 3.5 Write property test: auto-notes targets only empty non-given cells
    - Add to `selection-utils.property.test.ts` (or a new `app-logic.property.test.ts`)
    - **Property 6: Auto-notes targets only empty non-given cells**
    - Extract auto-notes logic as a pure function for testability
    - For any board, multi-selection, and digit, only empty non-given cells in selection have notes toggled
    - **Validates: Requirements 5.1, 5.2**

  - [x] 3.6 Write property test: multi-erase clears notes only on empty non-given cells in selection
    - **Property 7: Multi-erase clears notes only on empty non-given cells in selection**
    - Extract multi-erase logic as a pure function for testability
    - For any board, multi-selection, and notes board, only empty non-given cells in selection have notes cleared
    - **Validates: Requirements 6.1, 6.2**

- [x] 4. Checkpoint - Ensure all tests pass after App.svelte changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Grid.svelte for pointer events and selection visuals
  - [x] 5.1 Update Grid.svelte props and selection rendering
    - Replace `selectedRow`/`selectedCol` props with `selection: Selection` prop
    - Add `onCellExtend`, `onCellToggle`, `onDragEnd` callback props
    - Import `isSelected` and `isMultiSelection` from selection-utils
    - Add `data-row={r}` and `data-col={c}` attributes to each cell button
    - Apply `bg-blue-50 dark:bg-blue-900/20` to cells where `isSelected(selection, r, c)` is true
    - Apply `ring-2 ring-blue-500 z-10` to the focusCell
    - Ensure selection highlight is visually distinct from conflict, digit, and notes highlights
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 5.2 Implement pointer event handling for drag and modifier-click
    - Replace `onclick` with `onpointerdown` handler on each cell button
    - In `onpointerdown`: detect `e.ctrlKey || e.metaKey` → call `onCellToggle`, else call `onCellSelect`; call `setPointerCapture(e.pointerId)`; set local `isDragging = true`
    - Add `onpointermove` on the grid container: if `isDragging`, use `document.elementFromPoint(e.clientX, e.clientY)` to find cell under pointer via `data-row`/`data-col`, call `onCellExtend` if cell changed
    - Add `onpointerup` and `onlostpointercapture` on grid container: set `isDragging = false`, call `onDragEnd`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 4.1, 4.2, 4.3_

  - [x] 5.3 Wire updated Grid props in App.svelte template
    - Pass `selection` instead of `selectedRow`/`selectedCol` to Grid
    - Pass `handleCellExtend`, `handleCellToggle`, and a no-op `onDragEnd` callback
    - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [x] 6. Final checkpoint - Ensure all tests pass and app compiles
  - Run `bun run test` and `bun run type-check`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All selection logic is pure/functional — no DOM dependencies in selection-utils
- Grid.svelte pointer events handle both mouse and touch via the Pointer Events API
