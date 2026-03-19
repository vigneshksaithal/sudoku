# Implementation Plan: UI Redesign & Refactor

## Overview

Incremental implementation of the Sudoku UI redesign: extract pure functions (TDD), redesign Grid visuals, redesign NumberPad with mode tabs, restructure App layout for responsive two-layout system, and clean up dead code. Each task builds on the previous, with property tests validating correctness properties from the design.

## Tasks

- [x] 1. Extract pure functions for cell class computation and box tint
  - [x] 1.1 Create `src/client/lib/grid-utils.ts` with `getBoxTint` and `getCellClasses` pure functions
    - Extract `getBoxTint(r, c)` returning `'light' | 'dark'` based on `(Math.floor(r/3) + Math.floor(c/3)) % 2`
    - Extract `getCellClasses(params: CellClassParams)` that accepts cell state, selection, highlights, and returns a class string
    - Define `CellClassParams` type with `r`, `c`, `cell: CellState`, `selected`, `focused`, `highlightDigit`, `isNoteHighlight`, `isPrimary`, `isSecondary`, `hasConflict`
    - Implement amber selection highlight (`bg-amber-200` / `bg-amber-500/40`) instead of blue (`bg-blue-300`)
    - Implement alternating box tint logic in the background classes
    - Implement given digit styling (`font-semibold text-neutral-900`) vs user digit styling (`text-blue-600`)
    - Implement highlight precedence: conflict > selection (amber) > digit match (blue) > note match (yellow) > box tint
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 9.1_

  - [x] 1.2 Write unit tests for `getBoxTint` and `getCellClasses`
    - Create `src/client/lib/__tests__/grid-utils.test.ts`
    - Test `getBoxTint`: (0,0)→light, (0,3)→dark, (3,0)→dark, (3,3)→light, (8,8)→light
    - Test `getCellClasses` selected cell → string contains `bg-amber`
    - Test `getCellClasses` given cell → string contains `font-semibold`
    - Test `getCellClasses` user cell → string contains `text-blue-600`
    - Test `getCellClasses` conflict cell → string contains `text-red-600`
    - Test `getCellClasses` selected + digit highlight → amber wins over blue
    - Test `getCellClasses` conflict + selected → conflict text color present
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.3, 7.4, 9.1_

  - [ ]* 1.3 Write property test: Selected cells receive amber highlight (Property 1)
    - **Property 1: Selected cells receive amber highlight**
    - Create `src/client/lib/__tests__/grid-utils.property.test.ts`
    - Generate random (r, c) in 0–8 and random CellState with `selected=true`; assert class string includes `bg-amber`
    - **Validates: Requirements 2.4, 7.1, 7.2**

  - [ ]* 1.4 Write property test: Box tint alternation consistency (Property 2)
    - **Property 2: Box tint alternation consistency**
    - Generate random (r1, c1) and (r2, c2); assert same-box pairs get same tint, adjacent-box pairs get different tint
    - **Validates: Requirement 2.5**

  - [ ]* 1.5 Write property test: Selection highlight precedence over digit/note highlights (Property 5)
    - **Property 5: Selection highlight takes precedence over digit/note highlights**
    - Generate random cell that is both selected and matches highlightDigit; assert class includes amber, not `bg-blue-200`
    - **Validates: Requirement 7.3**

  - [ ]* 1.6 Write property test: Conflict highlight precedence over selection (Property 6)
    - **Property 6: Conflict highlight takes precedence over selection**
    - Generate random cell with `hasConflict=true` and various selection/highlight states; assert `text-red-600` always present
    - **Validates: Requirement 7.4**

- [x] 2. Checkpoint — Verify extracted pure functions
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Redesign Grid.svelte with new visuals
  - [x] 3.1 Refactor `src/client/components/Grid.svelte` to use extracted `getCellClasses` and `getBoxTint`
    - Import `getCellClasses` and `getBoxTint` from `grid-utils.ts`
    - Replace inline `getCellClass` method with call to the extracted pure function
    - Apply alternating box tint backgrounds using `getBoxTint`
    - Change selection highlight from blue to amber/orange (`bg-amber-200` light, `bg-amber-500/40` dark)
    - Ensure given digits render `font-semibold text-neutral-900 dark:text-neutral-100`
    - Ensure user digits render `text-blue-600 dark:text-blue-400`
    - Maintain existing notes display (3×3 mini-grid), technique highlights, hint digit ghost
    - Maintain box borders (2px) and cell borders (1px) hierarchy
    - Support light and dark themes via Tailwind `dark:` variants
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 7.1, 7.2, 7.3, 7.4, 9.1, 12.2_

- [x] 4. Redesign NumberPad.svelte with mode tabs and new layout
  - [x] 4.1 Rewrite `src/client/components/NumberPad.svelte` with new structure
    - Add Normal/Candidate tab toggle row at top (segmented tab control)
    - Normal tab: filled/highlighted when `notesMode=false`, muted otherwise
    - Candidate tab: filled/highlighted when `notesMode=true`, muted otherwise
    - Place Undo button (↩ "Undo") and Hint button (💡) at top-right alongside tabs
    - Render 5-column digit grid: row 1 = [1,2,3,4,5], row 2 = [6,7,8,9,✕(erase)]
    - Completed digits (count ≥ 9) get `opacity-40` but remain clickable (no `disabled` attribute)
    - Add Auto Candidate Mode checkbox below digit grid, reflecting `autoCandidateActive` state
    - Update props: replace `autoCandidateDisabled` with `autoCandidateActive: boolean`
    - Ensure minimum touch targets: digit buttons ≥ 36×36px, Undo/Hint ≥ 44×44px, mode tabs ≥ 36px height
    - Support light and dark themes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 11.1, 11.2, 11.3, 11.5, 12.3_

  - [ ]* 4.2 Write property test: Mode tab mutual exclusivity (Property 3)
    - **Property 3: Mode tab mutual exclusivity**
    - Create `src/client/lib/__tests__/numberpad-utils.property.test.ts`
    - Extract a pure function `getModeTabState(notesMode: boolean)` returning which tab is active
    - Generate random boolean for notesMode; assert exactly one tab is active
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 4.3 Write property test: Completed digits faded but interactive (Property 4)
    - **Property 4: Completed digits are faded but remain interactive**
    - Extract a pure function `getDigitButtonState(digit, digitCounts)` returning `{ faded: boolean, disabled: boolean }`
    - Generate random digit (1–9) and random count; when count ≥ 9, assert faded=true and disabled=false
    - **Validates: Requirements 3.6, 3.7**

- [x] 5. Checkpoint — Verify Grid and NumberPad redesign
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Redesign App.svelte layout for responsive two-layout system
  - [x] 6.1 Refactor `src/client/App.svelte` playing screen layout
    - Replace `max-w-md flex-col` inner layout with responsive flex: `flex-col sm:flex-row`
    - Desktop (≥640px): Grid on left (~60% via `sm:w-3/5`), ControlPanel on right (~40% via `sm:w-2/5`)
    - Mobile (<640px): Grid on top, ControlPanel below (vertical stack)
    - Root container: `h-full w-full overflow-hidden flex flex-col`
    - Difficulty tabs: full width, `shrink-0`, compact pill-shaped buttons (`text-xs py-1 px-2`)
    - Content area: `flex-1 min-h-0` with responsive flex direction
    - Grid container: `aspect-square max-h-full` to shrink when vertical space is constrained
    - Controls area: `shrink-0` on mobile, flexible on desktop
    - HintPanel: renders between Grid and NumberPad (mobile) or below Grid (desktop)
    - Add `autoCandidateActive` derived state: `$derived(board.length > 0 && hasAutoCandidates(board, notesBoard))`
    - Pass `autoCandidateActive` to NumberPad instead of `autoCandidateDisabled`
    - Ensure no overflow at 343×512px minimum viewport
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.4, 8.1, 8.2, 8.3, 8.4, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 6.2 Write property test: Auto-candidate checkbox reflects computed state (Property 7)
    - **Property 7: Auto-candidate checkbox reflects computed state**
    - Add to `src/client/lib/__tests__/app-logic.property.test.ts`
    - Generate random board and notesBoard states; assert checkbox checked value equals `hasAutoCandidates(board, notesBoard)`
    - **Validates: Requirement 5.4**

- [x] 7. Remove IconButton.svelte if no longer needed
  - [x] 7.1 Audit IconButton usage across all components
    - Check if NumberPad.svelte still imports IconButton after redesign
    - Check if any other component imports IconButton
    - If no remaining imports, delete `src/client/components/IconButton.svelte`
    - If still used (e.g., by Undo/Hint buttons), keep it and skip deletion
    - _Requirements: 9.3_

- [x] 8. Code quality refactor across components
  - [x] 8.1 Ensure all components follow Svelte 5 runes and Tailwind-only styling
    - Verify all reactive state uses `$state`, `$derived`, `$props` — no Svelte 4 syntax
    - Verify no `<style>` blocks in any Svelte component — Tailwind utility classes only
    - Organize App.svelte event handlers into logical groups with consistent naming
    - Ensure NumberPad props interface is clearly typed with explicit callback types
    - Remove any dead code, unused imports, or commented-out code
    - _Requirements: 9.2, 9.3, 9.4, 9.5_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design uses TypeScript throughout — all code examples and implementations use TypeScript with Svelte 5 + Tailwind CSS 4
- The project uses Vitest for unit tests and fast-check for property-based tests
