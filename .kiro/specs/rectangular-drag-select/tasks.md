# Implementation Plan: Rectangular Drag Select

## Overview

Replace freeform drag-to-select with rectangular box-select. Add `computeRectSelection` and `cellFromPointer` pure functions, remove `extendSelection` and `toggleSelection`, update Grid.svelte to use `setPointerCapture` with grid-relative math, and update App.svelte to wire the new `onDragSelect` callback. All changes are in TypeScript/Svelte.

## Tasks

- [x] 1. Add new selection utility functions
  - [x] 1.1 Implement `computeRectSelection` in `src/client/lib/selection-utils.ts`
    - Add `computeRectSelection(anchor: CellCoord, current: CellCoord): Selection` that computes the axis-aligned bounding rectangle between anchor and current, returning a Selection with all cells in that rectangle and `focusCell` set to `current`
    - Use `cellKey` to build the cells set by iterating rows from `min` to `max` and cols from `min` to `max`
    - _Requirements: 2.2, 2.5, 2.6, 7.1, 7.2, 7.3_

  - [ ]* 1.2 Write property test: computeRectSelection exact cell membership
    - **Property 2: computeRectSelection exact cell membership**
    - Generate random anchor/current coordinate pairs in [0,8], verify the returned Selection contains exactly the cells in the bounding rectangle and the count equals `(|anchor.row - current.row| + 1) × (|anchor.col - current.col| + 1)`
    - **Validates: Requirements 2.2, 2.5, 2.6, 7.1, 7.2, 7.3**

  - [ ]* 1.3 Write property test: computeRectSelection commutativity
    - **Property 3: computeRectSelection commutativity**
    - Generate random coordinate pairs, verify `computeRectSelection(a, b)` produces the same cells set as `computeRectSelection(b, a)`
    - **Validates: Requirements 7.4**

  - [x] 1.4 Implement `cellFromPointer` in `src/client/lib/selection-utils.ts`
    - Add `cellFromPointer(clientX: number, clientY: number, gridRect: { left: number; top: number; width: number; height: number }): CellCoord` that computes row/col by dividing pointer coordinates against the grid rect, clamped to [0,8]
    - Row = `clamp(Math.floor((clientY - gridRect.top) / (gridRect.height / 9)), 0, 8)`
    - Col = `clamp(Math.floor((clientX - gridRect.left) / (gridRect.width / 9)), 0, 8)`
    - _Requirements: 3.2, 6.1, 6.2, 7.5, 7.6_

  - [ ]* 1.5 Write property test: cellFromPointer in-bounds correctness
    - **Property 4: cellFromPointer in-bounds correctness**
    - Generate random grid rects (positive width/height) and in-bounds pointer coordinates, verify the returned (row, col) matches the expected formula
    - **Validates: Requirements 3.2, 6.1, 6.2, 7.6**

  - [ ]* 1.6 Write property test: cellFromPointer always returns valid coordinates
    - **Property 5: cellFromPointer always returns valid coordinates**
    - Generate random grid rects and arbitrary pointer coordinates (including outside the grid), verify `0 <= row <= 8` and `0 <= col <= 8`
    - **Validates: Requirements 3.4, 7.5**

- [x] 2. Update existing property tests for new selection model
  - [ ]* 2.1 Update Property 1: setSelection produces exclusive single-cell selection
    - **Property 1: setSelection produces exclusive single-cell selection**
    - Keep existing property test in `src/client/lib/__tests__/selection-utils.property.test.ts`, update imports to remove `extendSelection` and `toggleSelection`
    - **Validates: Requirements 1.1, 1.2, 1.3, 5.3**

  - [ ]* 2.2 Update Property 6: focusCell membership invariant
    - **Property 6: focusCell membership invariant**
    - Rewrite the operation sequence test to use `setSelection`, `computeRectSelection`, `moveFocus`, and `clearSelection` instead of `extendSelection`/`toggleSelection`
    - Verify: if `focusCell` is not null then `cells` contains `cellKey(focusCell[0], focusCell[1])`, if null then `cells.size === 0`
    - **Validates: Requirements 1.3, 2.2**

- [x] 3. Update unit tests for selection-utils
  - [x] 3.1 Update `src/client/lib/__tests__/selection-utils.test.ts`
    - Remove all `extendSelection` and `toggleSelection` test suites
    - Add unit tests for `computeRectSelection`: same cell → 1 cell, full row `(0,0)→(0,8)` → 9 cells, full column → 9 cells, 3×3 box → 9 cells
    - Add unit tests for `cellFromPointer`: top-left corner, bottom-right corner, outside grid (negative coords, beyond grid), cell boundary edges
    - Update `isMultiSelection` and `isSelected` tests to use `computeRectSelection` instead of `extendSelection`
    - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 8.1, 8.2_

- [x] 4. Checkpoint — Ensure all selection-utils tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Remove legacy selection functions and update consumers
  - [x] 5.1 Remove `extendSelection` and `toggleSelection` from `src/client/lib/selection-utils.ts`
    - Delete the `extendSelection` and `toggleSelection` function implementations and exports
    - _Requirements: 8.1, 8.2_

  - [x] 5.2 Update `src/client/App.svelte` to remove legacy handlers and add `handleDragSelect`
    - Remove imports of `extendSelection` and `toggleSelection`
    - Remove `handleCellExtend` and `handleCellToggle` handler functions
    - Add `handleDragSelect` that accepts a `Selection` and assigns it to the `selection` state
    - Remove `onCellExtend={handleCellExtend}` and `onCellToggle={handleCellToggle}` props from the `<Grid>` component usage
    - Add `onDragSelect={handleDragSelect}` prop to the `<Grid>` component
    - _Requirements: 8.3, 8.4_

  - [x] 5.3 Update `src/client/components/Grid.svelte` props and pointer handling
    - Remove `onCellExtend` and `onCellToggle` callback props, add `onDragSelect: (selection: Selection) => void` prop
    - Import `computeRectSelection` and `cellFromPointer` from `selection-utils`
    - Add `anchorCell: CellCoord | null` internal state
    - Replace `handlePointerDown`: call `setPointerCapture()` on the grid element, record `anchorCell`, call `onCellSelect`
    - Remove shift+click toggle logic — treat shift+pointerdown as regular tap
    - Replace `handlePointerMove`: use `cellFromPointer` with `getBoundingClientRect()` to compute current cell, call `computeRectSelection(anchorCell, currentCell)`, invoke `onDragSelect`
    - Replace `handlePointerUp`: release pointer capture, clear `anchorCell`
    - Remove `data-row`/`data-col` attribute usage for pointer-move resolution (keep them only for accessibility/testing if needed)
    - Remove `document.elementFromPoint()` usage
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 6.1, 6.2, 6.3, 6.4, 8.4_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses TypeScript throughout — all code examples use TypeScript
- Property tests use `fast-check` (existing dependency) with minimum 100 iterations
- `data-row`/`data-col` attributes can remain on cell buttons for accessibility but must not be used for pointer-move cell resolution during drag
- Selection persistence across number taps (Requirement 5) is already handled by the existing `handleNumber`/`handleErase` logic which does not clear multi-cell selections
