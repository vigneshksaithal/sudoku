# Implementation Plan: Community Puzzle Submit

## Overview

This plan implements the community puzzle submission feature in incremental steps. It starts with pure validation logic and types, adds Redis-backed submission operations, wires up API routes, then builds the client UI. Each step builds on the previous one, and property-based tests validate correctness properties from the design.

## Tasks

- [x] 1. Add TypeScript types for the community puzzle feature
  - Add `PuzzleType`, `CommunityPuzzleResponse`, `GeneratedPuzzleResponse`, `PuzzleResponse`, `SubmissionHistoryEntry`, and `SubmitScreenState` types to `src/client/lib/types.ts`
  - Export `GameScreen` union extended with `'submit'` value
  - _Requirements: 9.1, 9.2, 9.3, 12.2, 12.3_

- [x] 2. Implement puzzle validation functions
  - [x] 2.1 Create `src/server/lib/puzzle-validator.ts` with pure validation functions
    - Implement `validatePuzzleFormat`: check length === 81, all digits 0-9, at least 17 non-zero digits
    - Implement `validatePuzzleConstraints`: check for duplicate digits in each row, column, and 3x3 box
    - Implement `validatePuzzleUniqueness`: use `countSolutions` from `sudoku.ts` to verify exactly 1 solution
    - Implement `classifyAndSolve`: use `createSolverState` + `solve` + `getDifficulty` from `sudoku.ts`
    - Implement `validatePuzzle`: full pipeline combining all steps, returning `ValidationResult`
    - Define and export all result types: `FormatValidationResult`, `ConstraintValidationResult`, `UniquenessValidationResult`, `ClassificationResult`, `ValidationResult`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3_

  - [x] 2.2 Write unit tests for puzzle-validator
    - Create `src/server/lib/__tests__/puzzle-validator.test.ts`
    - Test format validation: correct length, invalid characters, too few givens, valid format
    - Test constraint validation: row/col/box duplicates, clean board
    - Test uniqueness validation: unsolvable, multiple solutions, unique solution
    - Test classifyAndSolve: verify difficulty matches `getDifficulty` output
    - Test full pipeline: end-to-end valid puzzle, each failure mode
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2_

  - [x] 2.3 Write property test: format validation rejects invalid strings
    - Create `src/server/lib/__tests__/puzzle-validator.property.test.ts`
    - **Property 1: Any string not matching /^[0-9]{81}$/ with ≥17 non-zero digits must be rejected**
    - Generate arbitrary strings (wrong length, non-digit chars, fewer than 17 givens)
    - Assert `validatePuzzleFormat` returns `{ valid: false }` for all
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 2.4 Write property test: constraint validation rejects boards with duplicates
    - Add to `src/server/lib/__tests__/puzzle-validator.property.test.ts`
    - **Property 2: Any board with duplicate non-zero digits in a row/col/box must be rejected**
    - Generate 81-element arrays with intentional duplicate digits in a unit
    - Assert `validatePuzzleConstraints` returns `{ valid: false }`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.5 Write property test: uniqueness validation rejects puzzles with 0 or >1 solutions
    - Add to `src/server/lib/__tests__/puzzle-validator.property.test.ts`
    - **Property 3: Puzzles with 0 or >1 solutions must be rejected**
    - Use known multi-solution and unsolvable puzzle strings
    - Assert `validatePuzzleUniqueness` returns `{ valid: false }`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 2.6 Write property test: difficulty classification matches getDifficulty
    - Add to `src/server/lib/__tests__/puzzle-validator.property.test.ts`
    - **Property 4: classifyAndSolve difficulty must match getDifficulty output for the same puzzle**
    - Generate valid puzzles using `generatePuzzleWithDifficulty`, classify via `classifyAndSolve`
    - Assert result matches independent `getDifficulty` call on the same solve log
    - **Validates: Requirements 4.1, 4.2**

- [x] 3. Checkpoint — Ensure all validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement community submission operations
  - [x] 4.1 Create `src/server/lib/community-submit.ts` with Redis-backed operations
    - Implement `checkCooldown`: read `cooldown:{userId}` key, return `{ allowed: true }` or `{ allowed: false, remainingSeconds }`
    - Implement `setCooldown`: set `cooldown:{userId}` with 900-second TTL
    - Implement `addToSubmissionHistory`: `zAdd` to `submissions:{userId}` sorted set with timestamp score
    - Implement `getSubmissionHistory`: `zRange` on `submissions:{userId}`, fetch puzzle metadata from `puzzle:{postId}` hashes
    - Implement `incrementSolveCount`: `redis.incrBy` on `solveCount` field in `puzzle:{postId}` hash
    - Define and export types: `CooldownResult`, `SubmissionHistoryEntry`
    - _Requirements: 8.1, 8.2, 8.3, 11.1, 12.1, 12.3_

  - [x] 4.2 Write unit tests for community-submit
    - Create `src/server/lib/__tests__/community-submit.test.ts`
    - Test `checkCooldown`: no cooldown key → allowed, active cooldown → rejected with remaining seconds
    - Test `setCooldown`: key created with correct TTL
    - Test `addToSubmissionHistory`: post added to sorted set
    - Test `getSubmissionHistory`: returns entries with metadata, handles empty history
    - Test `incrementSolveCount`: increments and returns new count
    - _Requirements: 8.1, 8.2, 8.3, 11.1, 12.1_

  - [x] 4.3 Write property test: rate limiting rejects submissions within cooldown
    - Add to `src/server/lib/__tests__/community-submit.test.ts`
    - **Property 5: Submissions within 15 minutes of each other must be rejected**
    - Simulate sequential submissions with varying time gaps
    - Assert `checkCooldown` returns `{ allowed: false }` when cooldown key exists
    - **Validates: Requirements 8.1, 8.2**

- [x] 5. Add community API routes
  - [x] 5.1 Add `POST /api/community/validate` route to `src/server/index.ts`
    - Parse `puzzle` from request body
    - Call `validatePuzzle` from `puzzle-validator.ts`
    - Return `{ status: 'success', data: { difficulty, clueCount, preview } }` on success
    - Return `{ status: 'error', message }` on validation failure
    - _Requirements: 1.4, 1.5, 5.1, 5.2, 5.3_

  - [x] 5.2 Add `POST /api/community/submit` route to `src/server/index.ts`
    - Require logged-in user (`context.userId`)
    - Check cooldown via `checkCooldown`
    - Re-validate puzzle via `validatePuzzle`
    - Create Reddit custom post via `reddit.submitCustomPost` with title "Community Puzzle by u/{username} ({difficulty})"
    - Store puzzle data in `puzzle:{postId}` hash with fields: `type`, `creatorId`, `creatorUsername`, `difficulty`, `{difficulty}:puzzle`, `{difficulty}:solution`, `createdAt`, `solveCount`
    - Set cooldown via `setCooldown`
    - Add to submission history via `addToSubmissionHistory`
    - Submit attribution comment via `reddit.submitComment`
    - Return `{ status: 'success', data: { postUrl } }`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 8.1, 8.2, 8.3, 12.1_

  - [x] 5.3 Add `GET /api/community/my-puzzles` route to `src/server/index.ts`
    - Require logged-in user (`context.userId`)
    - Call `getSubmissionHistory` from `community-submit.ts`
    - Return `{ status: 'success', data: { puzzles } }`
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 5.4 Write route integration tests
    - Create `src/server/__tests__/community-routes.test.ts`
    - Test validate route: valid puzzle returns difficulty + clueCount, invalid puzzle returns error
    - Test submit route: successful submission creates post + stores data + sets cooldown, cooldown rejection, unauthenticated rejection
    - Test my-puzzles route: returns submission history, empty history, unauthenticated rejection
    - _Requirements: 1.4, 6.1, 6.2, 6.3, 8.2, 12.2, 12.3_

- [x] 6. Checkpoint — Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Modify existing routes for community puzzle support
  - [x] 7.1 Extend `GET /api/puzzle` in `src/server/index.ts` for community puzzles
    - Read `type` field from `puzzle:{postId}` hash
    - If `type === 'community'`: return `type`, `creatorUsername`, single difficulty `puzzles`/`solutions`, and `solveCount`
    - If no `type` field (auto-generated): return existing response with `type: 'generated'`
    - _Requirements: 9.1, 9.2, 9.3, 11.2_

  - [x] 7.2 Extend `POST /api/solve` in `src/server/index.ts` for solve count tracking
    - After successful `recordSolve`, check if puzzle `type === 'community'`
    - If community puzzle, call `incrementSolveCount` from `community-submit.ts`
    - _Requirements: 11.1, 11.3_

  - [x] 7.3 Write tests for modified routes
    - Add tests to `src/server/__tests__/community-routes.test.ts`
    - Test GET /api/puzzle with community puzzle data returns correct shape
    - Test GET /api/puzzle with auto-generated puzzle returns backward-compatible shape
    - Test POST /api/solve increments solve count for community puzzles
    - Test solve count deduplication: second solve by same user does not increment
    - **Property 6: Each user counted at most once per puzzle for solve count**
    - **Validates: Requirements 9.1, 11.1, 11.3**

- [x] 8. Implement SubmitPuzzle client component
  - [x] 8.1 Create `src/client/components/SubmitPuzzle.svelte`
    - Implement `input` state: text input for 81-char puzzle string + "Validate" button
    - Implement `validating` state: loading indicator, disabled button
    - Implement `preview` state: render 9x9 grid with givens, show difficulty badge + clue count, "Confirm" and "Cancel" buttons
    - Implement `submitting` state: loading indicator during post creation
    - Implement `success` state: success message + link to new post + "Submit Another" button
    - Implement "My Puzzles" section: fetch and display submission history with difficulty, date, solve count
    - Handle all error states with descriptive messages
    - Accept `onClose` prop for returning to main screen
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 10.1, 10.2, 10.3, 10.4, 10.5, 12.2, 12.3_

- [x] 9. Integrate community puzzle support into App.svelte
  - [x] 9.1 Add submit screen to `src/client/App.svelte`
    - Add `'submit'` to `GameScreen` type / screen state
    - Add "Submit a Puzzle" button to the playing screen controls
    - Render `SubmitPuzzle` component when `screen === 'submit'`
    - _Requirements: 10.5_

  - [x] 9.2 Adapt App.svelte for community puzzle display
    - Detect `type === 'community'` from puzzle API response
    - Store `puzzleType`, `creatorUsername`, `solveCount` state variables
    - Display "Submitted by u/{creatorUsername}" label for community puzzles
    - Hide difficulty selector for community puzzles, show single difficulty badge
    - Display solve count for community puzzles
    - Ensure all existing game features work with community puzzles (cell input, notes, hints, undo, validation, leaderboard)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.2_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Run `bun run test && bun run type-check`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 6 correctness properties from the design
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript throughout, matching the existing codebase
- All validation logic is pure and synchronous, making it ideal for property-based testing with fast-check
