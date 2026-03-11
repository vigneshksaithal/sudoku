# Implementation Plan: Hint System

## Overview

Add a hint system to the Sudoku game. The server's `/api/puzzle` response is extended to include solution strings. Client-side pure functions select the best hint cell (fewest candidates). App state tracks hints used, enforces the cap, and briefly highlights the hinted cell. All implementation follows strict TDD — write failing tests first, then minimal implementation.

Build order: server extension → hint-logic pure functions (with tests) → component modifications → App wiring.

## Tasks

- [x] 1. Extend `/api/puzzle` to return solutions (TDD)
  - [x] 1.1 Write failing tests for solutions in `/api/puzzle` response
    - Add to `src/server/__tests__/api.test.ts`
    - Test: response `json.data.puzzles` contains the four puzzle strings (update existing shape assertion)
    - Test: response `json.data.solutions` contains one 81-char string per difficulty
    - Test: each solution string contains only digits 1–9 (no zeros)
    - Test: existing `GET /api/puzzle omits solutions from response` test should be removed/replaced
    - Tests must fail initially (Red phase)
    - _Requirements: 6.1, 6.2_

  - [x] 1.2 Update `/api/puzzle` handler in `src/server/index.ts`
    - Read `${d}:solution` keys from Redis alongside puzzle keys
    - Build a `solutions` record parallel to `puzzles`
    - Return `{ status: 'success', data: { puzzles, solutions } }` instead of `{ status: 'success', data: puzzles }`
    - Run `bun run test` — all 1.1 tests must pass (Green phase)
    - _Requirements: 6.1, 6.2_

- [x] 2. Add `HintCell` type to shared types
  - Add `export type HintCell = { row: number; col: number; value: number }` to `src/client/lib/types.ts`
  - _Requirements: 2.3, 2.4_

- [x] 3. Implement `hint-logic.ts` pure functions (TDD)
  - [x] 3.1 Write unit tests for `isHintApplicable`
    - Create `src/client/lib/__tests__/hint-logic.test.ts`
    - Test: returns `false` for a given cell (isGiven: true)
    - Test: returns `false` for a filled cell (value !== 0)
    - Test: returns `true` for an empty non-given cell with valid solution value 1–9
    - Test: returns `false` for a cell that is both given and filled
    - Tests must fail initially (Red phase)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.2 Write unit tests for `getBestHintCell`
    - Add to `src/client/lib/__tests__/hint-logic.test.ts`
    - Test: returns `null` when all cells are filled (no empty non-given cells)
    - Test: returns the only empty non-given cell when exactly one exists
    - Test: returns the cell with fewest valid candidates when multiple empty cells exist
    - Test: returned `value` matches `solution[row * 9 + col]`
    - Test: returned cell satisfies `value === 0 && isGiven === false`
    - Test: tie-breaking — returns lowest cell index when two cells share minimum candidate count
    - Tests must fail initially (Red phase)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.3 Implement `src/client/lib/hint-logic.ts`
    - Create the file with `isHintApplicable`, `countValidCandidates`, and `getBestHintCell`
    - `isHintApplicable(board, row, col, solutionValue): boolean` — pure, no mutations
    - `countValidCandidates(board, row, col): number` — counts digits 1–9 that don't conflict with peers
    - `getBestHintCell(board, solution): HintCell | null` — scans all 81 cells, returns min-candidate empty non-given cell
    - Run `bun run test` — all 3.1 and 3.2 tests must pass (Green phase)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 3.4 Write property test: `getBestHintCell` returns null on complete board (Property 1)
    - Add `src/client/lib/__tests__/hint-logic.property.test.ts`
    - Use `fast-check` to generate fully-filled boards (all cells value 1–9, isGiven varies)
    - **Property 1: getBestHintCell returns null on a complete board**
    - **Validates: Requirement 2.2**

  - [x] 3.5 Write property test: result is always an empty non-given cell (Property 2)
    - Add to `src/client/lib/__tests__/hint-logic.property.test.ts`
    - Generate boards with at least one empty non-given cell and a valid solution array
    - **Property 2: getBestHintCell result is always an empty non-given cell**
    - **Validates: Requirements 2.1, 2.4**

  - [x] 3.6 Write property test: result value matches the solution (Property 3)
    - Add to `src/client/lib/__tests__/hint-logic.property.test.ts`
    - For any board/solution pair where result is non-null, assert `result.value === solution[result.row * 9 + result.col]`
    - **Property 3: getBestHintCell result value matches the solution**
    - **Validates: Requirement 2.3**

  - [x] 3.7 Write property test: `isHintApplicable` rejects given and filled cells (Property 7)
    - Add to `src/client/lib/__tests__/hint-logic.property.test.ts`
    - Generate cells where `isGiven === true` or `value !== 0`, assert `isHintApplicable` returns `false`
    - **Property 7: isHintApplicable rejects given and filled cells**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 3.8 Write property test: `isHintApplicable` is consistent with `getBestHintCell` (Property 6)
    - Add to `src/client/lib/__tests__/hint-logic.property.test.ts`
    - For any board/solution where `getBestHintCell` returns non-null `{ row, col, value }`, assert `isHintApplicable(board, row, col, value) === true`
    - **Property 6: isHintApplicable is consistent with getBestHintCell**
    - **Validates: Requirement 7.4**

- [x] 4. Checkpoint — Verify hint logic and server
  - Ensure all tests pass, ask the user if questions arise.
  - Run `bun run test && bun run type-check`, confirm zero failures.

- [x] 5. Add hint button to `NumberPad.svelte`
  - Modify `src/client/components/NumberPad.svelte`
  - Add props: `onHint: () => void`, `hintsRemaining: number`, `hintsDisabled: boolean`
  - Render a "Hint (N)" button where N is `hintsRemaining`
  - Disable the button and apply distinct muted styling when `hintsDisabled` is true
  - Apply enabled styling (e.g. amber/yellow tones) when available
  - Minimum 44px touch target, light/dark mode via Tailwind `dark:` variants
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 6. Add hint highlight to `Grid.svelte`
  - Modify `src/client/components/Grid.svelte`
  - Add prop: `hintCell: { row: number; col: number } | null`
  - Apply amber/orange highlight class (e.g. `bg-amber-200 dark:bg-amber-800/50`) to the hinted cell
  - Hint highlight takes visual precedence over selection highlight but not conflict highlight
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 7. Wire hint state and handler in `App.svelte`
  - [x] 7.1 Add solutions state and update `fetchPuzzles`
    - Add `let solutions: Record<Difficulty, string> | null = $state(null)` to `src/client/App.svelte`
    - Update `fetchPuzzles` to parse `json.data.puzzles` and `json.data.solutions` from the new response shape
    - Store solutions in the new `solutions` state variable
    - _Requirements: 6.3, 6.4_

  - [x] 7.2 Add hint counter state and derived values
    - Add `let hintsUsed: number = $state(0)` and `let hintCell: { row: number; col: number } | null = $state(null)`
    - Add `const MAX_HINTS = 3` constant
    - Add `const hintsRemaining = $derived(MAX_HINTS - hintsUsed)`
    - Add `const hintsDisabled = $derived(hintsRemaining === 0 || screen !== 'playing' || solutions === null)`
    - Reset `hintsUsed` and `hintCell` when starting a new puzzle
    - _Requirements: 1.2, 1.3, 1.4, 5.1, 5.4_

  - [x] 7.3 Implement `handleHint` handler
    - Guard: return early if `solutions === null` or `hintsUsed >= MAX_HINTS`
    - Parse `solutions[difficulty]` into a flat 81-element number array
    - Call `getBestHintCell(board, solutionFlat)` — return early if null
    - Place `hint.value` into `board[hint.row][hint.col]`
    - Call `clearCellNotes`, `cleanupNotes`, `updateConflicts`, increment `hintsUsed`
    - Set `hintCell = { row: hint.row, col: hint.col }`, then `setTimeout(() => { hintCell = null }, 1500)`
    - Call `checkCompletion()`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.3, 5.1, 5.2, 8.1, 8.2_

  - [x] 7.4 Pass new props to NumberPad and Grid
    - Pass `onHint={handleHint}`, `hintsRemaining`, `hintsDisabled` to `NumberPad`
    - Pass `hintCell` to `Grid`
    - _Requirements: 1.1, 4.2_

- [x] 8. Final checkpoint — Full verification
  - Run `bun run test && bun run type-check && bun run check` to verify everything compiles and all tests pass.
  - Ensure all components are wired together with no orphaned code.
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- TDD is mandatory for all non-Svelte code: write failing tests first, then implement
- Svelte component modifications (tasks 5, 6, 7) skip test files — use `svelte-autofixer` instead
- The existing `GET /api/puzzle omits solutions from response` test in `api.test.ts` must be replaced in task 1.1 since the new behavior intentionally includes solutions
- `fast-check` is already installed — no new dependencies needed
- `MAX_HINTS = 3` is the default cap; define as a named constant, not a magic number
- Each task references specific requirements for traceability
