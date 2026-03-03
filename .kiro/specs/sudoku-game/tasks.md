# Implementation Plan: Sudoku Game

## Overview

Build a playable Sudoku puzzle embedded in Reddit posts via Devvit. Server generates three independent puzzles per post (easy/medium/hard) with guaranteed unique solutions, stores them in Redis, and validates submissions. Client is a Svelte 5 webview with difficulty selection, grid interaction, conflict detection, and completion flow.

Implementation follows strict TDD: for each module, write failing tests first, then implement the minimal code to pass, then refactor. Build order is bottom-up: pure generation engine → server wiring → API routes → client types/utils → UI components → final integration. Every checkpoint gates on `bun run test && bun run type-check`.

## Tasks

- [x] 1. Implement the Sudoku generation engine (TDD)
  - [x] 1.1 Write unit tests for board serialization functions
    - Create `src/server/lib/__tests__/sudoku.test.ts`
    - Test `boardToString`: empty board (all zeros), full board, specific index mapping (row = floor(i/9), col = i%9)
    - Test `stringToBoard`: 81-char string → 9×9 grid, round-trip with `boardToString`
    - Test `shuffled`: returns same elements in (potentially) different order, does not mutate input
    - Tests must fail initially (Red phase — no implementation exists yet)
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 1.2 Implement board types and serialization functions
    - Create `src/server/lib/sudoku.ts`
    - Define `Board` type as `number[][]` (9×9 grid, 0 = empty)
    - Implement `boardToString(board: Board): string` — flatten to 81-char string
    - Implement `stringToBoard(str: string): Board` — parse 81-char string to 9×9 grid
    - Implement `shuffled(arr: number[]): number[]` — Fisher-Yates shuffle
    - All functions as arrow function expressions with explicit return types
    - Run `bun run test` — all 1.1 tests must pass (Green phase)
    - _Requirements: 13.1, 13.2, 13.3_

  - [x] 1.3 Write unit tests for validation and solver functions
    - Add tests to `src/server/lib/__tests__/sudoku.test.ts`
    - Test `isValid`: valid placement, row conflict, column conflict, box conflict, zero (empty) handling
    - Test `solve`: known solvable partial board → returns true + board is complete, unsolvable board → returns false
    - Test `countSolutions`: board with 1 solution → returns 1, board with multiple solutions → returns 2 (capped)
    - Tests must fail initially (Red phase)
    - _Requirements: 1.1, 1.2, 1.3, 2.4_

  - [-] 1.4 Implement validation and solver functions
    - Add to `src/server/lib/sudoku.ts`
    - Implement `isValid(board: Board, row: number, col: number, num: number): boolean`
    - Implement `solve(board: Board): boolean` — backtracking solver, mutates board in place
    - Implement `countSolutions(board: Board, limit?: number): number` — counting solver that stops at limit (default 2)
    - Run `bun run test` — all 1.3 tests must pass (Green phase)
    - _Requirements: 1.1, 1.2, 1.3, 2.4_

  - [x] 1.5 Write unit tests for solution generation and hole-punching
    - Add tests to `src/server/lib/__tests__/sudoku.test.ts`
    - Test `fillDiagonalBoxes`: three diagonal boxes filled with digits 1–9, rest remains zero
    - Test `generateSolution`: returns a complete valid 9×9 board (all rows/cols/boxes valid)
    - Test `punchHoles`: returned board has correct number of zeros, all non-zero cells match original solution, does not mutate input
    - Tests must fail initially (Red phase)
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.6 Implement solution generation and hole-punching
    - Add to `src/server/lib/sudoku.ts`
    - Implement `fillDiagonalBoxes(board: Board): void`
    - Implement `generateSolution(): Board`
    - Implement `punchHoles(solution: Board, cellsToRemove: number): Board`
    - Deep-copy the solution before mutating, shuffle cell removal order, restore cell if countSolutions > 1, accept current state if target can't be reached
    - Run `bun run test` — all 1.5 tests must pass (Green phase)
    - _Requirements: 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.7 Write property tests for the generation engine (Properties 1–4)
    - Create `src/server/lib/__tests__/sudoku.property.test.ts`
    - Use `fast-check` with minimum 100 iterations per property
    - **Property 1: Generated solutions are valid Sudoku boards** — every row, column, and 3×3 box contains digits 1–9 exactly once
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - **Property 2: Three solutions per post are distinct** — no two of three generated solutions are identical
    - **Validates: Requirements 1.5**
    - **Property 3: Puzzle given counts match difficulty specification** — givens ≤ expected count, ≥ 17 minimum
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - **Property 4: Generated puzzles have exactly one solution** — countSolutions returns 1
    - **Validates: Requirements 2.4**
    - Run `bun run test` — all property tests must pass

- [x] 2. Checkpoint — Verify generation engine
  - Run `bun run test && bun run type-check`, confirm zero failures. Ask the user if questions arise.

- [x] 3. Wire puzzle generation into post creation and Redis storage (TDD)
  - [x] 3.1 Write integration tests for post creation
    - Create `src/server/__tests__/post.test.ts`
    - Use `createDevvitTest()` for per-test isolated Redis and Reddit API mocks
    - Test `createPost`: generates 3 puzzles, stores 6 board strings + createdAt in Redis hash `puzzle:{postId}`, calls `reddit.submitCustomPost` with title "Sudoku"
    - Test error case: `subredditName` missing → throws descriptive error
    - Use `vi.spyOn(reddit, 'submitCustomPost')` to mock the Reddit API call
    - Verify Redis hash fields: `easy:puzzle`, `easy:solution`, `medium:puzzle`, `medium:solution`, `hard:puzzle`, `hard:solution`, `createdAt`
    - Tests must fail initially (Red phase)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3_

  - [x] 3.2 Implement post creation with puzzle generation and storage
    - Update `src/server/post.ts`
    - Import `generateSolution`, `punchHoles`, `boardToString` from `./lib/sudoku`
    - Import `redis` from `@devvit/web/server`
    - Define `CELLS_TO_REMOVE = { easy: 35, medium: 45, hard: 54 } as const`
    - Generate three independent solutions, punch holes, store in Redis, submit custom post
    - Run `bun run test` — all 3.1 tests must pass (Green phase)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1, 6.2, 6.3_

- [x] 4. Add API routes for puzzle retrieval and validation (TDD)
  - [x] 4.1 Write integration tests for API routes
    - Create `src/server/__tests__/api.test.ts`
    - Use `createDevvitTest()` for per-test isolated Redis
    - Seed Redis with known puzzle/solution data before each relevant test
    - Test `GET /api/puzzle`: returns three puzzle strings, omits solutions, returns 400 when puzzle not found, returns 400 when postId missing
    - Test `POST /api/validate`: correct board → `{ valid: true }`, incorrect board → `{ valid: false }`, missing fields → 400, invalid difficulty → 400, invalid board length → 400
    - Use `app.request()` to test Hono routes directly (no server startup)
    - Tests must fail initially (Red phase)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4_

  - [x] 4.2 Implement `GET /api/puzzle` route in `src/server/index.ts`
    - Read `context.postId`, return 400 if missing
    - Read puzzle strings from Redis hash, return 400 if not found
    - Return `{ status: 'success', data: { easy, medium, hard } }` — omit solutions
    - Run `bun run test` — GET /api/puzzle tests must pass
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.3 Implement `POST /api/validate` route in `src/server/index.ts`
    - Parse body with `.catch(() => null)`, return 400 if null
    - Validate board (81 chars, digits 0–9) and difficulty (easy/medium/hard)
    - Read solution from Redis, compare, return `{ valid: true/false }`
    - Run `bun run test` — POST /api/validate tests must pass
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 4.4 Write property test for validation correctness (Property 5)
    - Create `src/server/__tests__/api.property.test.ts`
    - Use `fast-check` to generate random 81-char solution strings
    - **Property 5: Validation returns true if and only if board matches solution**
    - **Validates: Requirements 5.1, 5.2, 5.3**
    - Run `bun run test` — property test must pass

- [x] 5. Checkpoint — Verify server routes
  - Run `bun run test && bun run type-check`, confirm zero failures. Ask the user if questions arise.

- [x] 6. Implement client types and utility functions (TDD)
  - [x] 6.1 Create `src/client/lib/types.ts` with shared client types
    - Define `Difficulty = 'easy' | 'medium' | 'hard'`
    - Define `GameScreen = 'picking' | 'playing' | 'completed'`
    - Define `CellState = { value: number; isGiven: boolean; hasConflict: boolean }`
    - _Requirements: 7.1, 8.3, 10.1_

  - [x] 6.2 Write unit tests for client utility functions
    - Create `src/client/lib/__tests__/sudoku-utils.test.ts`
    - Test `parseBoard`: 81-char string → correct CellState[][] with isGiven flags, zeros get isGiven: false
    - Test `boardToString`: CellState[][] → 81-char string, round-trip with parseBoard
    - Test `hasConflict`: row duplicate → true, column duplicate → true, box duplicate → true, no duplicate → false, zero cells ignored
    - Test `updateConflicts`: sets hasConflict correctly for all cells after placement
    - Test `isComplete`: all filled + no conflicts → true, has zeros → false, has conflicts → false
    - Tests must fail initially (Red phase)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 13.1, 13.2, 13.3_

  - [x] 6.3 Implement `src/client/lib/sudoku-utils.ts` with game logic functions
    - Implement `parseBoard`, `boardToString`, `hasConflict`, `updateConflicts`, `isComplete`
    - Run `bun run test` — all 6.2 tests must pass (Green phase)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 11.1, 13.1, 13.2, 13.3_

  - [x] 6.4 Write property tests for client utilities (Properties 6–9)
    - Create `src/client/lib/__tests__/sudoku-utils.property.test.ts`
    - Use `fast-check` with minimum 100 iterations per property
    - **Property 6: Board string serialization round-trip** — grid → string → grid produces equivalent board
    - **Validates: Requirements 13.1, 13.2, 13.3**
    - **Property 7: Conflict detection correctness** — hasConflict returns true iff duplicate exists in row/col/box
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
    - **Property 8: Given cells are immutable** — parseBoard marks non-zero cells as isGiven, placement logic skips them
    - **Validates: Requirements 9.2, 9.3, 9.4**
    - **Property 9: Completion detection** — isComplete returns true iff all cells non-zero and no conflicts
    - **Validates: Requirements 11.1**
    - Run `bun run test` — all property tests must pass

- [x] 7. Checkpoint — Verify client utilities
  - Run `bun run test && bun run type-check`, confirm zero failures. Ask the user if questions arise.

- [x] 8. Build the Grid component
  - [x] 8.1 Create `src/client/components/Grid.svelte`
    - Accept props: `board: CellState[][]`, `selectedRow: number | null`, `selectedCol: number | null`, `onCellSelect: (row: number, col: number) => void`
    - Render 9×9 CSS grid with thicker borders at 3×3 box boundaries
    - Style given cells with `font-semibold` + muted background, distinct from user-editable cells
    - Highlight selected cell with a visual ring/border
    - Show conflict cells with red text/background
    - Minimum 36×36px cells, fit within 512px post height
    - Support light/dark mode via Tailwind `dark:` variants
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 12.1, 12.2_

- [x] 9. Build the NumberPad component
  - [x] 9.1 Create `src/client/components/NumberPad.svelte`
    - Accept props: `onNumber: (num: number) => void`, `onErase: () => void`
    - Render buttons for digits 1–9 and an erase action (✕)
    - Minimum 44px touch targets
    - Support light/dark mode via Tailwind `dark:` variants
    - _Requirements: 9.1, 12.1, 12.2_

- [x] 10. Wire everything together in App.svelte
  - [x] 10.1 Rewrite `src/client/App.svelte` with state machine and game flow
    - Manage state: `screen` (picking/playing/completed), `puzzles`, `difficulty`, `board`, `selectedRow`, `selectedCol`, `loading`, `error`
    - On mount: fetch `GET /api/puzzle`, store three board strings, handle loading/error states
    - **Picking screen**: Show three difficulty buttons (easy/medium/hard), on select → parse board → transition to playing
    - **Playing screen**: Render Grid + NumberPad, handle cell selection, number placement (skip givens), erase action, call `updateConflicts` after each change
    - On number placement: ignore if no cell selected or cell is given; place digit, recalculate conflicts
    - On erase: ignore if no cell selected or cell is given; clear cell, recalculate conflicts
    - When `isComplete` returns true: POST `/api/validate` with board string and difficulty
    - On `{ valid: true }`: transition to completed screen with success message
    - On `{ valid: false }`: show failure message, remain in playing state
    - **Completed screen**: Success message + "Try another difficulty" button → back to picking
    - Handle fetch errors gracefully: show error message, allow retry
    - _Requirements: 7.1, 7.2, 7.3, 9.2, 9.3, 9.4, 10.4, 11.1, 11.2, 11.3_

- [x] 11. Final checkpoint — Full verification
  - Run `bun run test && bun run type-check && bun run check` to verify everything compiles and all tests pass.
  - Ensure all components are wired together with no orphaned code.
  - Ask the user if questions arise.

## Notes

- All testing tasks are required — tests must be written before implementation code per TDD workflow
- Test infrastructure: Vitest + `@devvit/test` (createDevvitTest) + `fast-check` for property tests
- Server integration tests use `createDevvitTest()` for in-memory Redis and Reddit API mocks with per-test isolation
- Hono routes are tested via `app.request()` — no server startup needed
- Each task references specific requirements for traceability
- Checkpoints gate on `bun run test && bun run type-check` — zero failures required
- Svelte components (tasks 8–10) skip test files — use `svelte-autofixer` instead
- Implementation uses TypeScript with `strict: true`, arrow function expressions, and explicit return types per AGENTS.md coding principles
