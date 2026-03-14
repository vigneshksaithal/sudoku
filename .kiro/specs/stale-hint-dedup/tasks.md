# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Stale Elimination Hint Re-detection
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to a concrete naked pair scenario: construct a board with a known naked pair, apply the elimination to a `notesBoard`, then rebuild candidates with `buildCandidateBoard(board, notesBoard)` and verify the eliminated digits are excluded from the candidate sets
  - Test file: `src/client/lib/technique-hints/__tests__/candidate-board.test.ts`
  - Set up a board where a naked pair exists (e.g., two cells in a row with candidates {4,5}, other cells containing 4 or 5)
  - Build candidate board, detect the naked pair hint via `findTechniqueHint`
  - Simulate applying the elimination: remove the eliminated digits from a `notesBoard` (using plain `Set` for testing, not `SvelteSet`)
  - Rebuild candidates with `buildCandidateBoard(board, notesBoard)` — assert the eliminated digits are no longer in the candidate sets
  - Assert `findTechniqueHint` with the new candidates does NOT return the same elimination hint
  - Run test on UNFIXED code — expect FAILURE (confirms the bug: `buildCandidateBoard` ignores `notesBoard` parameter since it doesn't exist yet)
  - Document counterexamples: `buildCandidateBoard(board)` produces identical candidates before and after elimination because it has no `notesBoard` parameter
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Unchanged Candidate Computation Without Notes
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `src/client/lib/technique-hints/__tests__/candidate-board.test.ts`
  - Observe: `buildCandidateBoard(emptyBoard)` returns all 9 candidates per cell on unfixed code
  - Observe: `buildCandidateBoard(partialBoard)` correctly excludes peer values on unfixed code
  - Observe: `buildCandidateBoard(filledBoard)` returns empty sets on unfixed code
  - Write property-based test: for any valid 9x9 board, `buildCandidateBoard(board)` equals `buildCandidateBoard(board, emptyNotesBoard)` where `emptyNotesBoard` is a 9x9 grid of empty `Set<number>` — passing `undefined` or an all-empty notes board must produce identical results
  - Write property-based test: for any board and any `notesBoard`, the result of `buildCandidateBoard(board, notesBoard)` is always a subset of `buildCandidateBoard(board)` — notes can only remove candidates, never add them (monotonicity)
  - Verify tests pass on UNFIXED code (the optional parameter with `undefined` should fall through to existing behavior)
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for stale elimination hint re-detection

  - [x] 3.1 Add optional `NotesBoard` parameter to `buildCandidateBoard`
    - File: `src/client/lib/technique-hints/candidate-board.ts`
    - Import `NotesBoard` type from `'../types'`
    - Change signature from `(board: CellState[][])` to `(board: CellState[][], notesBoard?: NotesBoard)`
    - For each empty cell, after computing candidates from peer values, check if `notesBoard` is provided and the cell's notes set is non-empty (`notesBoard[r]?.[c]?.size > 0`)
    - If notes set is non-empty, intersect computed candidates with the notes set (only keep digits present in both)
    - If notes set is empty or `notesBoard` is `undefined`, use computed candidates as-is (preserving current behavior)
    - _Bug_Condition: isBugCondition(input) where input has notesBoard with eliminations but buildCandidateBoard ignores them_
    - _Expected_Behavior: buildCandidateBoard(board, notesBoard) excludes eliminated digits from candidate sets when notesBoard has non-empty entries_
    - _Preservation: When notesBoard is undefined or all cells are empty sets, output is identical to original buildCandidateBoard(board)_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Pass `notesBoard` to `buildCandidateBoard` in `handleHint`
    - File: `src/client/App.svelte`
    - In `handleHint`, change `buildCandidateBoard(board)` to `buildCandidateBoard(board, notesBoard)`
    - This ensures user eliminations from previously applied hints are reflected in the candidate board
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Stale Elimination Hint Re-detection
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Unchanged Candidate Computation Without Notes
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `bun run test` and confirm zero failures
  - Run `bun run type-check` and confirm no type errors
  - Ensure all tests pass, ask the user if questions arise
