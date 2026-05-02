# Implementation Plan: Candidate Size and Notes Leaderboard

## Overview

This plan implements two related improvements: (1) increasing candidate digit font sizes in Grid.svelte (CSS-only), and (2) adding full-stack "Notes Used" tracking with leaderboard column and score comment integration. Tasks follow the TDD approach: write failing tests first, then implement, then verify. The implementation language is TypeScript throughout.

## Tasks

- [x] 1. Increase candidate digit font size in Grid.svelte
  - Change Tailwind classes on candidate `<span>` elements from `text-[0.5rem]` to `text-[0.65rem]` and from `sm:text-[0.6rem]` to `sm:text-[0.75rem]`
  - Preserve existing `p-px` padding and `leading-none` line-height
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Extend server-side validation and types for notesUsed
  - [x] 2.1 Write failing tests for `validateSolveInput` notesUsed handling
    - Add tests to `src/server/lib/__tests__/leaderboard.test.ts`:
      - Accepts payload with `notesUsed: true`
      - Accepts payload with `notesUsed: false`
      - Rejects payload with `notesUsed: "true"` (string)
      - Rejects payload with `notesUsed: 1` (number)
      - Rejects payload with `notesUsed: null`
      - Rejects payload with missing `notesUsed`
    - Run `bun run test` — new tests should fail
    - _Requirements: 3.2, 3.3, 3.4_

  - [x] 2.2 Implement `validateSolveInput` notesUsed validation in `src/server/lib/leaderboard.ts`
    - Add `notesUsed` boolean validation after existing numeric field checks
    - Extend return type to include `notesUsed: boolean`
    - Update `LeaderboardEntry` type to add `notesUsed: boolean | undefined`
    - Run `bun run test` — new tests should pass
    - _Requirements: 3.2, 3.3, 3.4, 7.1_

  - [x] 2.3 Write property test: solve input validation accepts notesUsed iff boolean
    - **Property 1: Solve input validation accepts notesUsed if and only if it is a boolean**
    - Add to `src/server/lib/__tests__/leaderboard.property.test.ts`
    - For any valid base payload, `validateSolveInput` returns parsed object iff `notesUsed` is boolean; returns error string for any non-boolean value
    - Minimum 100 iterations
    - **Validates: Requirements 3.2, 3.3**

- [x] 3. Extend `recordSolve` and `parseSolveRecord` for notesUsed persistence
  - [x] 3.1 Write failing tests for `recordSolve` and `parseSolveRecord` notesUsed handling
    - Add tests to `src/server/lib/__tests__/leaderboard.test.ts`:
      - `recordSolve` stores `notesUsed` as `"true"` or `"false"` in Redis hash
      - `parseSolveRecord` parses `notesUsed: "true"` to `true`
      - `parseSolveRecord` parses `notesUsed: "false"` to `false`
      - `parseSolveRecord` parses missing `notesUsed` to `undefined` (legacy records)
      - `parseSolveRecord` parses unexpected string values (e.g. `"yes"`) to `undefined`
    - Run `bun run test` — new tests should fail
    - _Requirements: 4.1, 4.2, 4.3, 7.3_

  - [x] 3.2 Implement `recordSolve` and `parseSolveRecord` notesUsed support in `src/server/lib/leaderboard.ts`
    - Add `notesUsed: boolean` to `recordSolve` params
    - Store `notesUsed: String(notesUsed)` in both post-level and global-level Redis hashes
    - Extend `parseSolveRecord` to read `notesUsed` field: `"true"` → `true`, `"false"` → `false`, anything else → `undefined`
    - Include `notesUsed` in returned `LeaderboardEntry`
    - Run `bun run test` — new tests should pass
    - _Requirements: 4.1, 4.2, 4.3, 7.1, 7.3_

  - [x] 3.3 Write property test: notes-used round-trip through Redis
    - **Property 2: Notes-used round-trip through Redis**
    - Add to `src/server/lib/__tests__/leaderboard.property.test.ts`
    - For any valid solve with boolean `notesUsed`, after `recordSolve` + `parseSolveRecord`, the `notesUsed` field equals the original value
    - Minimum 100 iterations
    - **Validates: Requirements 4.1, 4.2**

- [x] 4. Checkpoint — Ensure all leaderboard tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend score comment for notesUsed
  - [x] 5.1 Write failing tests for `formatScoreComment` notesUsed handling
    - Add tests to `src/server/lib/__tests__/score-comment.test.ts`:
      - Includes `"📝 Notes | Yes |"` when `notesUsed: true`
      - Includes `"📝 Notes | No |"` when `notesUsed: false`
    - Update existing test calls to include `notesUsed` field in `ScoreCommentData`
    - Run `bun run test` — new tests should fail
    - _Requirements: 6.1, 6.2_

  - [x] 5.2 Implement `formatScoreComment` notesUsed support in `src/server/lib/score-comment.ts`
    - Add `notesUsed: boolean` to `ScoreCommentData` type
    - Add `"📝 Notes"` row to the markdown stats table: `"Yes"` when `true`, `"No"` when `false`
    - Run `bun run test` — new tests should pass
    - _Requirements: 6.1, 6.2_

  - [x] 5.3 Write property test: score comment includes notes indicator
    - **Property 3: Score comment includes notes indicator**
    - Add to `src/server/lib/__tests__/score-comment.property.test.ts`
    - For any valid `ScoreCommentData` with boolean `notesUsed`, output contains `"📝 Notes | Yes |"` iff `notesUsed === true` and `"📝 Notes | No |"` iff `notesUsed === false`
    - Minimum 100 iterations
    - **Validates: Requirements 6.2**

- [x] 6. Update server routes to pass notesUsed through the pipeline
  - [x] 6.1 Write failing tests for route-level notesUsed handling
    - Add tests to `src/server/__tests__/leaderboard-routes.test.ts`:
      - `POST /api/solve` includes `notesUsed` in successful solve flow (verify stored in Redis)
      - `POST /api/solve` rejects non-boolean `notesUsed` with 400
    - Add tests to `src/server/__tests__/score-comment-routes.test.ts`:
      - `POST /api/score/comment` includes `notesUsed` in formatted comment text
    - Run `bun run test` — new tests should fail
    - _Requirements: 3.1, 6.3_

  - [x] 6.2 Update `POST /api/solve` route in `src/server/index.ts`
    - Destructure `notesUsed` from `parsed` result of `validateSolveInput`
    - Pass `notesUsed` to `recordSolve` call
    - _Requirements: 3.1, 4.1_

  - [x] 6.3 Update `POST /api/score/comment` route in `src/server/index.ts`
    - Pass `notesUsed` from parsed input to `formatScoreComment`
    - _Requirements: 6.3_

  - [x] 6.4 Write failing tests for leaderboard GET routes returning notesUsed
    - Add test to `src/server/__tests__/leaderboard-routes.test.ts`:
      - `GET /api/leaderboard/post` response entries include `notesUsed` field
      - Legacy entries without `notesUsed` are handled gracefully
    - _Requirements: 5.1, 7.3_

- [x] 7. Checkpoint — Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Add notesUsed tracking to App.svelte client state
  - Add `let notesUsed: boolean = $state(false)` state variable
  - Reset `notesUsed = false` in `resetRoundState()`
  - Set `notesUsed = true` at all latch points:
    - `handleNumber` when `notesMode` is true and `toggleNote` is called (cell-first mode)
    - `handleCellSelect` when `notesMode` is true and `toggleNote` is called (digit-first mode)
    - `handleAutoCandidate` (both enable and disable auto-candidates)
    - `handleNumber` when `isMultiSelection(selection)` and `applyAutoNotes` is called
    - `handleShiftCellSelect` when `notesMode` is true and `applyAutoNotes` is called
    - `handleKeyDown` for Shift+digit note toggle
  - Include `notesUsed` in `checkCompletion` POST `/api/solve` body
  - Include `notesUsed` in `handleScoreComment` POST `/api/score/comment` body
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 6.3_

- [ ] 9. Update Leaderboard.svelte to display Notes column
  - Update local `LeaderboardEntry` type to include `notesUsed: boolean | undefined`
  - Add "Notes" column header between "Err" and "Score"
  - Add Notes cell to each entry row: `true` → "Yes", `false` → "No", `undefined` → "-"
  - Add Notes cell to user entry row below the dashed divider
  - Update `colspan` on the divider `<td>` from 6 to 7
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.2_

- [ ] 10. Final checkpoint — Ensure all tests pass and types check
  - Run `bun run test && bun run type-check`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The CSS change (task 1) is independent and can be done at any point
- Server-side changes (tasks 2–7) should be completed before client-side changes (tasks 8–9) to ensure the API contract is stable
