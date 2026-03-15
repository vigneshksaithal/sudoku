# Implementation Plan: NumberPad UI Overhaul

## Overview

Four issues addressed in sequence: (1) add `countDigitPlacements` utility with TDD, (2) fix persistent digit highlighting in App.svelte, (3) fix "Try another difficulty" button, (4) redesign NumberPad to 3×3 grid with action column, alignment toggle, and solved-digit fading. Each task builds incrementally, wiring new logic into existing components.

## Tasks

- [x] 1. Add `countDigitPlacements` utility (TDD)
  - [x] 1.1 Write unit tests for `countDigitPlacements` in `src/client/lib/__tests__/sudoku-utils.test.ts`
    - Test empty board returns 0 for all digits
    - Test full valid board returns 9 for all digits
    - Test partial board returns correct counts
    - Test single digit placed returns 1 for that digit, 0 for others
    - Test returns Map with exactly 9 keys (1-9)
    - Test does not mutate input board
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 1.2 Write property tests for `countDigitPlacements` in `src/client/lib/__tests__/sudoku-utils.property.test.ts`
    - **Property 5: countDigitPlacements accuracy**
    - For any valid 9×9 CellState board, each count equals `board.flat().filter(c => c.value === d).length`
    - **Property 6: countDigitPlacements no mutation**
    - For any valid 9×9 CellState board, calling `countDigitPlacements` does not modify any cell
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 1.3 Implement `countDigitPlacements` in `src/client/lib/sudoku-utils.ts`
    - Export `countDigitPlacements(board: CellState[][]): ReadonlyMap<number, number>`
    - Initialize Map with keys 1-9 set to 0, iterate board, count each digit
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement persistent digit highlighting in `App.svelte`
  - [x] 3.1 Convert `highlightDigit` from `$derived` to `$state` and update imperatively
    - Replace `const highlightDigit = $derived(...)` with `let highlightDigit: number | null = $state(null)`
    - In `handleCellSelect`: set `highlightDigit` to cell value if > 0, leave unchanged if 0
    - In `handleNumber`: set `highlightDigit = num` before existing logic
    - In `handleKeyDown` Escape branch: set `highlightDigit = null`
    - In `changeDifficulty` and `fetchPuzzles`: set `highlightDigit = null`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 3.2 Run `svelte-autofixer` on `App.svelte`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 4. Fix "Try another difficulty" button in `App.svelte`
  - [x] 4.1 Import `closeExpandedMode` from `@devvit/web/client` and call it in `returnToPreview`
    - Add `import { closeExpandedMode } from '@devvit/web/client'`
    - Call `closeExpandedMode()` after `localStorage.removeItem(DIFFICULTY_STORAGE_KEY)`
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 4.2 Run `svelte-autofixer` on `App.svelte`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Add `PAD_ALIGNMENT_STORAGE_KEY` constant
  - [x] 6.1 Add `PAD_ALIGNMENT_STORAGE_KEY` to `src/client/lib/constants.ts`
    - Export `const PAD_ALIGNMENT_STORAGE_KEY = 'sudoku-pad-alignment' as const`
    - _Requirements: 3.6_

- [x] 7. Redesign `NumberPad.svelte` with 3×3 grid layout, action column, alignment toggle, and solved-digit fading
  - [x] 7.1 Add `padAlignment` state and `digitCounts` derived state to `App.svelte`
    - Import `countDigitPlacements` from `sudoku-utils`
    - Import `PAD_ALIGNMENT_STORAGE_KEY` from `constants`
    - Add `let padAlignment: 'left' | 'right' = $state('left')` with localStorage init (try-catch)
    - Add `const digitCounts = $derived(countDigitPlacements(board))`
    - Add `handleToggleAlignment` that flips value and persists to localStorage (try-catch)
    - Pass `digitCounts`, `padAlignment`, `onToggleAlignment` as new props to `<NumberPad>`
    - _Requirements: 3.6, 3.7, 3.8, 4.1, 4.5_

  - [x] 7.2 Rewrite `NumberPad.svelte` component
    - Accept new props: `digitCounts: ReadonlyMap<number, number>`, `padAlignment: 'left' | 'right'`, `onToggleAlignment: () => void`
    - Render digits 1-9 in a 3×3 grid (1-2-3 / 4-5-6 / 7-8-9)
    - Render action column vertically: Undo, Notes, Hint, Erase, alignment toggle (↔)
    - Use flexbox `order` to swap digit grid and action column based on `padAlignment`
    - Apply `opacity-40` class to digit buttons where `digitCounts.get(num) === 9` (keep clickable, not disabled)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2, 4.3, 4.4_

  - [x] 7.3 Run `svelte-autofixer` on `NumberPad.svelte` and `App.svelte`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.2, 4.3, 4.4_

- [x] 8. Final checkpoint — Ensure all tests pass and type-check succeeds
  - Run `bun run test` and `bun run type-check`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `.svelte` files use `svelte-autofixer` instead of unit tests per AGENTS.md
- Each task references specific requirements for traceability
- Property tests use fast-check (already in the project)
- `countDigitPlacements` is the only new pure function requiring TDD
