# Implementation Plan: Devvit Review Compliance

## Overview

This plan addresses two Devvit app review compliance issues: (1) community puzzle posts must be submitted as the user with UGC attribution, and (2) users need the ability to share solve scores as Reddit comments. The implementation starts with configuration and pure formatting logic, builds server-side helpers and routes, then adds the client UI button. Each step builds on the previous one.

## Tasks

- [x] 1. Update Devvit configuration for user-action permissions
  - Add `permissions.reddit.asUser` array with `"SUBMIT_POST"` and `"SUBMIT_COMMENT"` to `devvit.json`
  - Verify the config remains valid against the Devvit JSON schema
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement score comment formatter
  - [x] 2.1 Create `src/server/lib/score-comment.ts` with pure `formatScoreComment` function
    - Accept `{ difficulty: string, completionTime: number, hintsUsed: number, mistakesCount: number }`
    - Format time as `m:ss` (minutes:seconds with zero-padded seconds)
    - Return markdown-formatted string with difficulty, time, hints, mistakes in a table
    - Include "Perfect solve!" line when `hintsUsed === 0 && mistakesCount === 0`
    - Export `ScoreCommentData` type
    - _Requirements: 5.4, 7.1, 7.2_

  - [x] 2.2 Write unit tests for `formatScoreComment`
    - Create `src/server/lib/__tests__/score-comment.test.ts`
    - Test basic formatting: difficulty name, time in m:ss, hints count, mistakes count all present
    - Test perfect solve: hints=0 and mistakes=0 includes "Perfect solve!"
    - Test non-perfect solve: hints>0 or mistakes>0 does not include "Perfect solve!"
    - Test time formatting edge cases: 0 seconds → "0:00", 61 seconds → "1:01", large values
    - _Requirements: 5.4, 7.1, 7.2_

  - [x] 2.3 Write property test: score comment format completeness
    - Create `src/server/lib/__tests__/score-comment.property.test.ts`
    - **Property 1: Score comment format completeness**
    - Generate random valid `ScoreCommentData` (valid difficulty string, non-negative integers for completionTime/hintsUsed/mistakesCount)
    - Assert output contains the difficulty name, formatted time as m:ss, hints count, and mistakes count
    - **Validates: Requirements 5.4, 7.1**

  - [x] 2.4 Write property test: perfect solve indicator correctness
    - Add to `src/server/lib/__tests__/score-comment.property.test.ts`
    - **Property 2: Perfect solve indicator correctness**
    - Generate data with `hintsUsed=0, mistakesCount=0` → assert "Perfect solve!" present
    - Generate data with `hintsUsed>0` or `mistakesCount>0` → assert "Perfect solve!" absent
    - **Validates: Requirements 7.2**

- [x] 3. Implement sticky comment helper
  - [x] 3.1 Create `src/server/lib/sticky-comment.ts` with `createStickyComment` function
    - Accept dependencies `{ reddit, redis }`, a `postId`, and comment `text`
    - Submit comment as app account on the given post
    - Call `comment.distinguish('yes')` and `comment.sticky()` on the returned comment
    - Store comment ID in `puzzle:{postId}` hash under `stickyCommentId` field
    - Return `{ success: true, commentId }` on success, `{ success: false }` on any failure
    - Never throw — catch all errors, log them, and return failure result
    - Export `StickyCommentDeps` and `StickyCommentResult` types
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4_

  - [x] 3.2 Write unit tests for `createStickyComment`
    - Create `src/server/lib/__tests__/sticky-comment.test.ts`
    - Test happy path: comment submitted, distinguished, stickied, ID stored in Redis
    - Test failure: `reddit.submitComment` throws → returns `{ success: false }`, does not throw
    - Test failure: `comment.distinguish` throws → returns `{ success: false }`
    - Test Redis storage: verify `stickyCommentId` field is set in `puzzle:{postId}` hash
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint — Ensure all helper tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add sticky comment to daily post creation
  - [x] 5.1 Modify `createPost` in `src/server/post.ts` to call `createStickyComment` after post creation
    - Import and call `createStickyComment` with score thread text after storing puzzle data in Redis
    - Sticky comment text: "🏆 **Score Thread** — Share your solve time! Use the \"Comment My Score\" button after completing the puzzle."
    - Failure is non-blocking — post creation succeeds even if sticky comment fails
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 5.2 Update tests for `createPost`
    - Modify `src/server/__tests__/post.test.ts`
    - Test that `createPost` calls sticky comment creation after post
    - Test graceful degradation: sticky comment failure does not prevent post creation
    - _Requirements: 3.1, 3.4_

- [x] 6. Fix community submit for UGC compliance and add sticky comment
  - [x] 6.1 Modify `POST /api/community/submit` in `src/server/index.ts` for UGC compliance
    - Change `reddit.submitCustomPost()` call to include `runAs: 'USER'` and `userGeneratedContent: { text: puzzle }`
    - Keep the existing attribution comment as the app account (no `runAs: 'USER'`)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.2 Add `createStickyComment` call to community submit route
    - After post creation and Redis storage, call `createStickyComment` with score thread text
    - Non-blocking on failure — post response still returns success
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 6.3 Update community route tests
    - Modify `src/server/__tests__/community-routes.test.ts`
    - Test that community submit uses `runAs: 'USER'` and `userGeneratedContent`
    - Test that attribution comment is posted as app account (no `runAs`)
    - Test that sticky comment is created on community posts
    - Test graceful degradation: sticky comment failure does not block post creation
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.4_

- [x] 7. Checkpoint — Ensure all post creation and community route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement score comment endpoint
  - [x] 8.1 Add `POST /api/score/comment` route to `src/server/index.ts`
    - Guard: require `context.userId` (401 if missing)
    - Guard: require `context.postId` (400 if missing)
    - Validate request body: `difficulty`, `completionTime`, `hintsUsed`, `mistakesCount`
    - Read `stickyCommentId` from `puzzle:{postId}` hash (400 if missing with "Score thread unavailable" message)
    - Format comment text via `formatScoreComment`
    - Submit comment as user: `reddit.submitComment({ id: stickyCommentId, text, runAs: 'USER' })`
    - Return success or 500 on Reddit API failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 8.2 Write tests for score comment endpoint
    - Create `src/server/__tests__/score-comment-routes.test.ts`
    - Test happy path: valid input → comment submitted as user replying to sticky comment
    - Test 401: no userId → unauthorized error
    - Test 400: missing postId → error
    - Test 400: invalid body (missing fields, wrong types) → validation error
    - Test 400: no stickyCommentId in Redis → "Score thread unavailable"
    - Test 500: `reddit.submitComment` throws → descriptive error
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.7_

  - [x] 8.3 Write property test: score endpoint input validation
    - Add to `src/server/lib/__tests__/score-comment.property.test.ts`
    - **Property 3: Score endpoint input validation**
    - Generate random JSON payloads (both valid and invalid)
    - Pass through the validation logic, verify acceptance matches validity criteria
    - Valid: valid difficulty string, non-negative integer completionTime, non-negative integer hintsUsed, non-negative integer mistakesCount
    - **Validates: Requirements 5.1**

- [x] 9. Checkpoint — Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add "Comment My Score" button to completion screen
  - [x] 10.1 Add score comment state and UI to `src/client/App.svelte`
    - Add `scoreCommentState` variable with type `'idle' | 'posting' | 'success' | 'error'`
    - Add `scoreCommentError` variable for error messages
    - Reset `scoreCommentState` to `'idle'` in `resetRoundState()`
    - Add "Comment My Score" button to the completion screen (`screen === 'completed'`)
    - `idle`: button visible and clickable
    - `posting`: button disabled with loading indicator
    - `success`: button replaced with "✓ Score posted!" confirmation text
    - `error`: error message shown, button re-enabled for retry
    - On click: POST to `/api/score/comment` with `{ difficulty, completionTime: elapsedSeconds, hintsUsed, mistakesCount }`
    - On success: set state to `'success'`
    - On failure: set state to `'error'`, store error message for display
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Run `bun run test && bun run type-check`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 3 correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation language is TypeScript throughout, matching the existing codebase
- All Reddit API mocking uses `@devvit/test` with in-memory Redis
- The `formatScoreComment` function is pure, making it ideal for property-based testing with `fast-check`
- Sticky comment failures are always non-blocking — core functionality must succeed regardless
