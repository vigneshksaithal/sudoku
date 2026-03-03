# Implementation Plan: QQWing Puzzle Engine

## Overview

Full rewrite of `src/server/lib/sudoku.ts` from brute-force backtracking to a QQWing-style candidate-elimination solver with technique-based difficulty grading, symmetric clue removal, and solve history logging. Tests rewritten in `src/server/lib/__tests__/sudoku.test.ts` using Vitest + fast-check. Integration updates to types, routes, post creation, and client UI.

## Tasks

- [x] 1. Core data structures, index math, and type definitions
  - [x] 1.1 Write property tests and unit tests for index math and peer computation
    - Write fast-check property test for **Property 1: Index math round-trip** — `possibilityIndex` ↔ cell/valueIndex recovery, `rowColToCell(cellToRow, cellToCol)` round-trip, `cellToBox` range 0–8
    - Write fast-check property test for **Property 2: Peer count and membership** — 20 distinct peers per cell, correct house sharing, no self-inclusion
    - Write unit tests for edge cases: cell 0, cell 80, cell 40 (center)
    - **Property 1 validates: Requirements 1.1, 1.2, 1.4**
    - **Property 2 validates: Requirements 1.5**
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.2 Implement type definitions and index math functions
    - Define `LogType`, `LogItem`, `Symmetry`, `Difficulty`, `SolveStats` types
    - Implement `possibilityIndex`, `cellToRow`, `cellToCol`, `cellToBox`, `rowColToCell`
    - Implement peer computation (20 peers per cell)
    - Implement `countPossibilities`, `isPossible`, `isSolved`, `isImpossible` helpers
    - Remove old `Board` type, `isValid`, `fillDiagonalBoxes`, `punchHoles` exports
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 1.3 Write property tests and unit tests for mark and rollback
    - Write fast-check property test for **Property 3: Mark sets solution and eliminates candidates** — solution set, peer elimination, round tagging
    - Write fast-check property test for **Property 4: Mark-then-rollback round-trip** — state restoration after rollback
    - Write unit test for rollback removing solve log entries from the rolled-back round
    - **Property 3 validates: Requirements 1.3, 2.1, 2.2**
    - **Property 4 validates: Requirements 2.3, 2.4, 2.5, 17.4**
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.4 Implement mark and rollback operations
    - Implement solver state initialization (solution[], solutionRound[], possibilities[], solveLog, round)
    - Implement `mark(position, round, value)` — set solution, eliminate from peers, eliminate other candidates from self, tag with round
    - Implement `rollbackRound(round)` — restore solution, possibilities, remove log entries
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_


- [x] 2. Checkpoint — Core infrastructure tests pass
  - Ensure all tests pass (`bun run test`), ask the user if questions arise.

- [ ] 3. Naked single and hidden single techniques
  - [x] 3.1 Write property tests and unit tests for naked single
    - Write fast-check property test for **Property 5: Naked single detection and logging** — cell with 1 candidate gets placed, log entry has type `single`, correct value and position
    - Write unit test with a known board state where a specific cell has exactly 1 candidate
    - **Property 5 validates: Requirements 3.1, 3.2**
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.2 Implement naked single technique
    - Implement `onlyPossibilityForCell(round)` — scan all 81 cells, place value when exactly 1 candidate remains
    - Log entry with type `single`, value, and position when history recording is enabled
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 3.3 Write property tests and unit tests for hidden single
    - Write fast-check property test for **Property 6: Hidden single detection and logging** — candidate in only 1 cell within a house gets placed, correct log type per house
    - Write unit tests for hidden single in box, row, and column separately
    - Write unit test verifying technique ordering: box before row before column (Requirement 4.5)
    - **Property 6 validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.4 Implement hidden single techniques
    - Implement `onlyValueInSection(round)` — hidden single in box
    - Implement `onlyValueInRow(round)` — hidden single in row
    - Implement `onlyValueInColumn(round)` — hidden single in column
    - Log entries with types `hiddenSingleSection`, `hiddenSingleRow`, `hiddenSingleColumn`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 4. Solve loop with guess-and-backtrack
  - [x] 4.1 Write tests for solve loop and guess/backtrack
    - Write unit test: solve a known puzzle solvable by naked + hidden singles only (no guessing needed)
    - Write unit test: solve a puzzle requiring guessing, verify `guess` and `rollback` log entries
    - Write unit test: `solve` returns false for an impossible board
    - Write fast-check property test for **Property 12: Round parity** — guess entries have odd rounds, deduction entries have even rounds
    - Write unit test verifying technique ordering per Requirement 9.1 (singleSolveMove applies techniques in fixed order)
    - Write unit test verifying Requirement 9.2 (restart from beginning after progress)
    - **Property 12 validates: Requirements 10.6**
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 4.2 Implement singleSolveMove and solve loop
    - Implement `singleSolveMove(round)` — apply techniques in fixed order: naked single → hidden single (box, row, col), return after first progress
    - Implement `solve(round)` — loop singleSolveMove, then guess-and-backtrack fallback
    - Pick cell with fewest candidates for guessing, randomize candidate order
    - Use odd rounds for guesses, even for deductions
    - _Requirements: 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 5. Checkpoint — Solver with basic techniques passes all tests
  - Ensure all tests pass (`bun run test`), ask the user if questions arise.

- [ ] 6. Intermediate techniques — naked pairs
  - [x] 6.1 Write property tests and unit tests for naked pairs
    - Write fast-check property test for **Property 7: Naked pair elimination and logging** — two cells sharing exactly 2 candidates → eliminate from peers in house, correct log type
    - Write unit tests for naked pair in row, column, and box separately
    - Write unit test verifying technique ordering: row before column before box (Requirement 5.5)
    - **Property 7 validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 6.2 Implement naked pair technique
    - Implement `handleNakedPairs(round)` — detect naked pairs in row, column, box (in that order)
    - Eliminate the two shared candidates from all other cells in the house
    - Log entries with types `nakedPairRow`, `nakedPairColumn`, `nakedPairSection`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 7. Intermediate techniques — pointing pairs/triples and box/line reduction
  - [x] 7.1 Write property tests and unit tests for pointing pairs/triples
    - Write fast-check property test for **Property 8: Pointing pair/triple elimination and logging** — candidate confined to one row/col in a box → eliminate from rest of row/col
    - Write unit tests for pointing pair in row and column separately
    - Write unit test verifying row-based before column-based ordering (Requirement 6.4)
    - **Property 8 validates: Requirements 6.1, 6.2, 6.3**
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.2 Implement pointing pair/triple techniques
    - Implement `pointingRowReduction(round)` — candidate in box confined to one row
    - Implement `pointingColumnReduction(round)` — candidate in box confined to one column
    - Log entries with types `pointingPairTripleRow`, `pointingPairTripleColumn`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 7.3 Write property tests and unit tests for box/line reduction
    - Write fast-check property test for **Property 9: Box/line reduction elimination and logging** — candidate in row/col confined to one box → eliminate from rest of box
    - Write unit tests for box/line reduction in row and column separately
    - Write unit test verifying row-based before column-based ordering (Requirement 7.4)
    - **Property 9 validates: Requirements 7.1, 7.2, 7.3**
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 7.4 Implement box/line reduction techniques
    - Implement `rowBoxReduction(round)` — candidate in row confined to one box
    - Implement `colBoxReduction(round)` — candidate in column confined to one box
    - Log entries with types `rowBox`, `columnBox`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 8. Intermediate techniques — hidden pairs
  - [x] 8.1 Write property tests and unit tests for hidden pairs
    - Write fast-check property test for **Property 10: Hidden pair elimination and logging** — two candidates in only same two cells → eliminate other candidates from those cells
    - Write unit tests for hidden pair in row, column, and box separately
    - Write unit test verifying technique ordering: row before column before box (Requirement 8.5)
    - **Property 10 validates: Requirements 8.1, 8.2, 8.3, 8.4**
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.2 Implement hidden pair techniques
    - Implement `hiddenPairInRow(round)`, `hiddenPairInColumn(round)`, `hiddenPairInSection(round)`
    - Eliminate all other candidates from the two cells containing the hidden pair
    - Log entries with types `hiddenPairRow`, `hiddenPairColumn`, `hiddenPairSection`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.3 Wire all intermediate techniques into singleSolveMove
    - Update `singleSolveMove` to include naked pairs, pointing pairs/triples, box/line reduction, hidden pairs in the correct order per Requirement 9.1
    - Write unit test verifying full technique ordering in singleSolveMove
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 9. Checkpoint — All techniques pass tests
  - Ensure all tests pass (`bun run test`), ask the user if questions arise.


- [ ] 10. Generation, serialization, and difficulty classification
  - [x] 10.1 Write property tests and unit tests for serialization
    - Write fast-check property test for **Property 17: Serialization round-trip** — `stringToBoard(boardToString(arr))` returns original array for any 81-digit array
    - Write unit test for `stringToBoard` input validation (not 81 chars, non-digit chars)
    - **Property 17 validates: Requirements 22.1, 22.2, 22.3**
    - _Requirements: 22.1, 22.2, 22.3_

  - [x] 10.2 Implement serialization functions
    - Rewrite `boardToString` to work with flat `number[]` (not 2D `Board`)
    - Rewrite `stringToBoard` to return flat `number[]`, with input validation
    - _Requirements: 22.1, 22.2, 22.3_

  - [x] 10.3 Write property tests and unit tests for solution generation
    - Write fast-check property test for **Property 13: Generated solutions are valid Sudoku** — every row, col, box has 1–9, all 81 cells filled
    - Write unit test verifying non-determinism: two calls produce different solutions (Requirement 12.4)
    - **Property 13 validates: Requirements 12.1, 12.3**
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.4 Implement solution generation
    - Implement `generateSolution()` — solve empty grid with randomized cell visit order and digit try order (Fisher-Yates)
    - Return flat 81-element array
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [x] 10.5 Write property tests and unit tests for symmetry, puzzle generation, and countSolutions
    - Write fast-check property test for **Property 14: Generated puzzles have exactly one solution** — `countSolutions(puzzle, 2)` returns 1
    - Write fast-check property test for **Property 15: Symmetric clue removal preserves symmetry** — empty cells have all symmetric partners also empty
    - Write unit tests for `getSymmetricPartners` with each symmetry mode
    - Write unit test for `countSolutions` returning 0 for impossible board, 1 for unique, 2 for multiple
    - **Property 14 validates: Requirements 13.4**
    - **Property 15 validates: Requirements 13.5, 14.2, 14.3, 14.4, 14.5**
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 10.6 Implement symmetry helpers, countSolutions, and puzzle generation
    - Implement `getSymmetricPartners(cell, symmetry)` for all 5 modes
    - Rewrite `countSolutions` to use the candidate-elimination solver (not brute-force)
    - Implement `removeCluesToCreatePuzzle(solution, symmetry)` — iterate cells in shuffled order, remove in symmetric groups, restore if countSolutions > 1
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x] 10.7 Write property tests and unit tests for difficulty classification
    - Write fast-check property test for **Property 16: Difficulty classification from solve log** — correct tier based on log contents (expert if guess, intermediate if advanced techniques, easy if hidden singles, simple if only naked singles)
    - Write unit tests for `getSolveStats` returning correct counts
    - Write fast-check property test for **Property 18: Solve log completeness and structure** — entry per solved cell, valid fields, stats match
    - **Property 16 validates: Requirements 15.1, 15.2, 15.3, 15.4**
    - **Property 18 validates: Requirements 17.1, 17.2, 17.5**
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 17.1, 17.2, 17.3, 17.5_

  - [x] 10.8 Implement difficulty classification and solve stats
    - Implement `getDifficulty(log)` — classify based on most advanced technique in log
    - Implement `getSolveStats(log)` — count occurrences of each LogType
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 17.1, 17.2, 17.3, 17.5_

  - [x] 10.9 Write tests for difficulty-targeted generation
    - Write fast-check property test for **Property 11: Solver finds the unique solution** — solve known puzzles, verify rows/cols/boxes have 1–9
    - Write unit test for `generatePuzzleWithDifficulty` returning a puzzle with the target difficulty (or closest match)
    - Write unit test for `generatePuzzleWithDifficulty` respecting maxAttempts
    - **Property 11 validates: Requirements 11.2, 11.5**
    - _Requirements: 11.2, 11.5, 16.1, 16.2, 16.3, 16.4_

  - [x] 10.10 Implement difficulty-targeted generation
    - Implement `generatePuzzleWithDifficulty(target, symmetry?, maxAttempts?)` — retry loop generating puzzles until difficulty matches target
    - Return closest match if maxAttempts exhausted
    - Default symmetry to `rotate180`, default maxAttempts to 100
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

- [x] 11. Checkpoint — Generation and classification tests pass
  - Ensure all tests pass (`bun run test`), ask the user if questions arise.

- [ ] 12. Integration — server routes, post creation, and client
  - [x] 12.1 Write integration tests for updated API routes
    - Update `src/server/__tests__/api.test.ts` — test `GET /api/puzzle` returns 4 difficulties (simple, easy, intermediate, expert)
    - Test `POST /api/validate` accepts all 4 new difficulty values
    - Test `POST /api/validate` rejects old difficulty values (medium, hard)
    - Test `GET /api/puzzle` returns 400 when any of the 4 puzzles is missing
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x] 12.2 Update server routes for 4 difficulty levels
    - Update `VALID_DIFFICULTIES` in `src/server/index.ts` to `['simple', 'easy', 'intermediate', 'expert']`
    - Update `GET /api/puzzle` to return all 4 difficulty puzzles
    - Update `POST /api/validate` to accept all 4 difficulty values
    - _Requirements: 19.1, 19.2, 19.3, 19.4_

  - [x] 12.3 Write integration test for post creation
    - Update post creation test in `src/server/__tests__/api.test.ts` — verify 4 puzzles stored in Redis with keys `simple:puzzle`, `simple:solution`, `easy:puzzle`, etc.
    - Verify `createdAt` field is set
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 12.4 Update post creation for 4 difficulties
    - Rewrite `src/server/post.ts` — import `generatePuzzleWithDifficulty` and `boardToString` from new engine
    - Generate 4 puzzles targeting simple, easy, intermediate, expert with ROTATE180 symmetry
    - Store in Redis with pattern `{difficulty}:puzzle` and `{difficulty}:solution`
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x] 12.5 Update client types and difficulty picker
    - Update `Difficulty` type in `src/client/lib/types.ts` to `'simple' | 'easy' | 'intermediate' | 'expert'`
    - Update `App.svelte` difficulty picker to show 4 buttons: Simple, Easy, Intermediate, Expert
    - Update `fetchPuzzles` and `selectDifficulty` to work with 4 difficulty levels
    - _Requirements: 18.1, 18.2, 18.3, 21.1, 21.2, 21.3_

- [x] 13. Final checkpoint — Full test suite and type check pass
  - Run `bun run test && bun run type-check` and ensure zero failures.
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (18 properties total)
- The project follows strict TDD: write failing tests first, then implement
- All solver code lives in `src/server/lib/sudoku.ts` (single-file rewrite)
- All solver tests live in `src/server/lib/__tests__/sudoku.test.ts` (full rewrite)
- Integration tests live in `src/server/__tests__/api.test.ts`
- fast-check is already installed as a devDependency
