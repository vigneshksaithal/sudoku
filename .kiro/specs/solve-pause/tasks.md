# Implementation Plan: Solve Pause

## Overview

This plan extends the solve pipeline with a unified `unranked` boolean fed by two independent client paths: a user-initiated pause (button + blurred overlay, timer freeze, still ranked) and passive backgrounding (visibilitychange / pagehide, latches unranked, no overlay). Tasks follow the TDD discipline from AGENTS.md — write failing tests first, then implement, then verify. Sequencing: pure pause-reducer first so property tests have a subject and App.svelte has a dependency; server-side lib widening next (validator → recordSolve → parseSolveRecord → getLeaderboard fallback → score-comment) so the API contract stabilises before routes and client integration; then routes; then the client layer (App.svelte state/handlers → PauseOverlay → NumberPad prop → Leaderboard). The implementation language is TypeScript throughout.

## Tasks

- [x] 1. Extract pause/background state machine into a pure reducer
  - [x] 1.1 Write failing example tests for `src/client/lib/pause-reducer.ts`
    - Create `src/client/lib/__tests__/pause-reducer.test.ts`
    - Define expected `PauseState` shape `{ isPaused: boolean, unrankedDueToBackground: boolean }` and `PauseEvent` union (`PAUSE_PRESSED`, `RESUME`, `VISIBILITY_HIDDEN`, `VISIBILITY_SHOWN`, `PAGEHIDE`, `RESET_ROUND`)
    - Cover every transition from the design §Architecture stateDiagram-v2:
      - From `R0` (`isPaused=false, unranked=false`): `PAUSE_PRESSED` → `P0`; `VISIBILITY_HIDDEN` → `R1`; `PAGEHIDE` → `R1`; `VISIBILITY_SHOWN` is a no-op; `RESUME` is a no-op; `RESET_ROUND` stays at `R0`
      - From `P0`: `RESUME` → `R0`; `VISIBILITY_HIDDEN`/`PAGEHIDE` → `P1`; `PAUSE_PRESSED` is a no-op; `RESET_ROUND` → `R0`
      - From `R1`: `PAUSE_PRESSED` → `P1`; `VISIBILITY_HIDDEN`/`PAGEHIDE` stay at `R1`; `VISIBILITY_SHOWN` stays at `R1` (timer-restart is a side effect at the adapter layer, not reducer state); `RESUME` is a no-op; `RESET_ROUND` → `R0`
      - From `P1`: `RESUME` → `R1`; `VISIBILITY_HIDDEN`/`PAGEHIDE` stay at `P1`; `VISIBILITY_SHOWN` stays at `P1`; `PAUSE_PRESSED` is a no-op; `RESET_ROUND` → `R0`
    - Assert every transition returns a new object (immutability) and that `unrankedDueToBackground` is never cleared by any event other than `RESET_ROUND`
    - Run `bun run test` — new tests should fail (module does not exist yet)
    - _Requirements: 2.1, 2.2, 2.7, 4.1, 4.2, 4.6, 6.10, 7.4, 7.5, 7.6, 14.1, 14.2_

  - [x] 1.2 Implement `src/client/lib/pause-reducer.ts`
    - Export types `PauseState` and `PauseEvent`
    - Export `initialPauseState: PauseState = { isPaused: false, unrankedDueToBackground: false }`
    - Export `reduce(state: PauseState, event: PauseEvent): PauseState` as a pure function matching the state diagram transitions exactly
    - No side effects, no mutation of the input state, explicit return type
    - Run `bun run test` — example tests should pass
    - _Requirements: 2.1, 2.2, 2.7, 4.1, 4.2, 4.6, 6.10, 7.4, 7.5, 7.6, 14.1, 14.2_

  - [x] 1.3 Write property test for background-latch behavior
    - **Property 3: unrankedDueToBackground latches true after first background event**
    - Create `src/client/lib/__tests__/pause-reducer.property.test.ts`
    - For any fast-check generated event sequence of length 1 to 50 drawn from `{ PAUSE_PRESSED, RESUME, VISIBILITY_HIDDEN, VISIBILITY_SHOWN, PAGEHIDE }` containing at least one `VISIBILITY_HIDDEN` or `PAGEHIDE`, fold `reduce` over the sequence starting from `initialPauseState` and assert `unrankedDueToBackground === true` for every intermediate state at or after the index of the first background event (no `RESET_ROUND` in the sequence)
    - Minimum 100 iterations
    - **Validates: Requirements 6.10, 7.4, 13.5, 15.3**

  - [x] 1.4 Write property test for manual-pause independence
    - **Property 4: PAUSE/RESUME sequences with no background event leave unrankedDueToBackground false**
    - Add to `src/client/lib/__tests__/pause-reducer.property.test.ts`
    - For any fast-check generated event sequence composed only of `PAUSE_PRESSED` and `RESUME` events, starting from `initialPauseState`, assert every intermediate state and the final state have `unrankedDueToBackground === false`
    - Minimum 100 iterations
    - **Validates: Requirements 2.7, 7.5, 7.6**

- [x] 2. Extend `validateSolveInput` for the `unranked` field
  - [x] 2.1 Write failing example tests for `validateSolveInput` unranked handling
    - Add tests to `src/server/lib/__tests__/leaderboard.test.ts`:
      - Accepts payload with `unranked: true` and returns `unranked: true` in the result
      - Accepts payload with `unranked: false` and returns `unranked: false`
      - Accepts payload with `unranked` key omitted and returns `unranked: false` (default)
      - Rejects payload with `unranked: "true"` (string)
      - Rejects payload with `unranked: 1` (number)
      - Rejects payload with `unranked: null`
      - Rejects payload with `unranked: {}` and `unranked: []`
      - Rejects error message identifies field `unranked` and mentions boolean, matching the shape of existing type-mismatch messages
    - Run `bun run test` — new tests should fail
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 2.2 Implement `validateSolveInput` unranked parsing in `src/server/lib/leaderboard.ts`
    - After existing field checks, read `obj.unranked`
    - If `undefined` → default `false`; if `typeof === 'boolean'` → use the value; else → return error string `"Invalid unranked: must be a boolean"`
    - Widen the success-type union to include `unranked: boolean`
    - Run `bun run test` — unit tests should pass
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 2.3 Write property test for validator/unranked contract
    - **Property 6: validateSolveInput errors iff unranked is present and not boolean**
    - Add to `src/server/lib/__tests__/leaderboard.property.test.ts`
    - For any valid base payload, generate `v` via fast-check from the union of non-boolean JSON values (integers, floats, strings including `"true"`/`"false"`, `null`, arrays, objects), augment the payload with `{ unranked: v }`, assert `validateSolveInput` returns a string (error)
    - For the same valid base payload without an `unranked` key, assert `validateSolveInput` returns a successful object with `unranked: false`
    - For `unranked: true` and `unranked: false`, assert the successful result carries that exact boolean
    - Minimum 100 iterations
    - **Validates: Requirements 9.1, 9.2, 9.3**

- [x] 3. Thread `unranked` through `recordSolve` persistence
  - [x] 3.1 Write failing example tests for `recordSolve` unranked behavior
    - Add tests to `src/server/lib/__tests__/leaderboard.test.ts`:
      - When called with `unranked: true`, both `solve:{postId}:{difficulty}:{userId}` and `solve:global:{difficulty}:{userId}` hashes are written with `unranked: "true"`
      - When called with `unranked: true`, `zAdd` is NOT called on `leaderboard:{postId}:{difficulty}` nor on `leaderboard:global:{difficulty}` (assert via Redis mock call log)
      - When called with `unranked: true`, the return value is `{ postRank: null, globalRank: null, adjustedTime }`
      - When called with `unranked: false`, both hashes are written with `unranked: "false"` and both `zAdd` calls are made with `adjustedTime` = `completionTime + hintsUsed × 30`
      - When called with `unranked: false`, returned `postRank` and `globalRank` are non-null numbers derived from `zRank + 1`
    - Run `bun run test` — new tests should fail
    - _Requirements: 8.1, 10.1, 10.2, 10.3, 10.6_

  - [x] 3.2 Implement `recordSolve` unranked support in `src/server/lib/leaderboard.ts`
    - Add `unranked: boolean` to the params type of `recordSolve`
    - Serialise via `String(unranked)` into both post-level and global-level hash writes
    - Gate both `zAdd` calls on `unranked === false`; skip entirely when `unranked === true` (no score-less placeholder)
    - Widen the success return type to `{ postRank: number | null, globalRank: number | null, adjustedTime: number }`; return `null` for both rank fields when `unranked === true`
    - Preserve existing `completionTime + hintsUsed × 30` adjusted-time formula
    - Run `bun run test` — unit tests should pass
    - _Requirements: 8.1, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 3.3 Write property tests for round-trip and ranked-membership
    - **Property 1: Solve record round-trip preserves unranked**
    - Add to `src/server/lib/__tests__/leaderboard.property.test.ts`: for any generated solve input (valid difficulty, non-negative integer `completionTime`/`hintsUsed`/`mistakesCount`, boolean `notesUsed`, boolean `unranked`), after `recordSolve` followed by `parseSolveRecord` against the post-level hash, the produced entry's `unranked` equals the original input value; repeat against the global-level hash on the first solve
    - Minimum 100 iterations
    - **Validates: Requirements 10.1, 11.1, 11.2, 15.1**

    - **Property 2: Sorted-set membership iff unranked === false**
    - Add to `src/server/lib/__tests__/leaderboard.property.test.ts`: for any generated solve input persisted via `recordSolve`, assert `userId` is a member of both `leaderboard:{postId}:{difficulty}` and `leaderboard:global:{difficulty}` if and only if input `unranked === false`; when `unranked === false`, assert `zScore` on the per-post sorted set equals `computeAdjustedTime(completionTime, hintsUsed)`
    - Minimum 100 iterations
    - **Validates: Requirements 10.2, 10.3, 11.4, 15.2**

- [x] 4. Widen `parseSolveRecord` for unranked and legacy records
  - [x] 4.1 Write failing example tests for `parseSolveRecord` unranked parsing
    - Add tests to `src/server/lib/__tests__/leaderboard.test.ts`:
      - Hash field `unranked: "true"` → entry `unranked: true`
      - Hash field `unranked: "false"` → entry `unranked: false`
      - Hash missing `unranked` key → entry `unranked: false` (legacy)
      - Hash field `unranked: ""` → entry `unranked: false`
      - Hash field `unranked: "maybe"` (unexpected string) → entry `unranked: false` without throwing
    - Extend the existing `LeaderboardEntry` type assertion in tests to accept `rank: number | null`
    - Run `bun run test` — new tests should fail
    - _Requirements: 11.1, 11.2, 11.3, 12.1, 12.2, 12.3_

  - [x] 4.2 Implement `parseSolveRecord` unranked parsing in `src/server/lib/leaderboard.ts`
    - Widen `LeaderboardEntry` in the shared type to `rank: number | null` and add `unranked: boolean`
    - Parse `unrankedRaw === 'true'` → `true`; anything else (missing, `"false"`, empty, unknown string) → `false`; never throw on unexpected values
    - Accept `rank: number | null` as the second argument so callers can build unranked entries with `null`
    - Run `bun run test` — unit tests should pass
    - _Requirements: 11.1, 11.2, 11.3, 12.1, 12.2, 12.3_

- [x] 5. Extend `getLeaderboard` with unranked-user fallback
  - [x] 5.1 Write failing example tests for `getLeaderboard` unranked fallback
    - Add tests to `src/server/lib/__tests__/leaderboard.test.ts`:
      - When `userId` has no sorted-set membership but the solve hash exists with `unranked: "true"`, `getLeaderboard` returns `userEntry` with `rank: null` and `unranked: true`
      - When `userId` has no sorted-set membership and no solve hash exists, `getLeaderboard` returns `userEntry: null`
      - When `userId` has no sorted-set membership but the solve hash exists with `unranked: "false"` (inconsistent state), `getLeaderboard` returns `userEntry: null` rather than fabricating a rank
      - Top-N entries never carry `unranked: true` (they come from the sorted set which only holds ranked members)
      - When `userId` IS in the sorted set, the existing in-top-N fallback path is unchanged and returns the user entry with a numeric `rank`
    - Run `bun run test` — new tests should fail
    - _Requirements: 11.4, 11.5, 12.5_

  - [x] 5.2 Implement `getLeaderboard` unranked-user fallback in `src/server/lib/leaderboard.ts`
    - After the existing `zRank` check, when `zRank` returns `undefined` AND `userId` is provided, `hGetAll` the per-scope solve hash at `${solveKeyPrefix}:${userId}`
    - Parse with `parseSolveRecord(userData, null)`; if the parsed entry exists and `entry.unranked === true`, return it as `userEntry`; otherwise return `userEntry: null`
    - Leave the top-N entries list untouched
    - Run `bun run test` — unit tests should pass
    - _Requirements: 11.4, 11.5, 12.5_

- [x] 6. Extend `formatScoreComment` with the unranked row
  - [x] 6.1 Write failing example tests for `formatScoreComment` unranked handling
    - Add tests to `src/server/lib/__tests__/score-comment.test.ts`:
      - Given `ScoreCommentData` with `unranked: true`, output contains the literal substring `"| 🏁 Unranked | Yes |"` placed immediately after the `"📝 Notes"` row
      - Given `ScoreCommentData` with `unranked: false`, output does NOT contain `"🏁 Unranked"` anywhere
      - Perfect-solve formatting (existing branch) still fires when `unranked: true`
    - Update existing test fixtures in this file to add the new `unranked: boolean` field to every `ScoreCommentData` literal
    - Run `bun run test` — new tests should fail
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 6.2 Implement `formatScoreComment` unranked row in `src/server/lib/score-comment.ts`
    - Add `unranked: boolean` to the exported `ScoreCommentData` type
    - Append `"| 🏁 Unranked | Yes |"` to the markdown rows array after the notes row iff `data.unranked === true`
    - Leave the perfect-solve logic unchanged
    - Run `bun run test` — unit tests should pass
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 6.3 Write property test for the score comment unranked row
    - **Property 5: formatScoreComment includes 🏁 Unranked row iff data.unranked === true**
    - Add to `src/server/lib/__tests__/score-comment.property.test.ts`
    - For any fast-check generated `ScoreCommentData` (arbitrary `difficulty` string, non-negative integer `completionTime`/`hintsUsed`/`mistakesCount`, boolean `notesUsed`, boolean `unranked`), assert the output string contains `"| 🏁 Unranked | Yes |"` iff `unranked === true`
    - Minimum 100 iterations
    - **Validates: Requirements 8.4, 8.5**

- [x] 7. Wire `unranked` through the server routes
  - [x] 7.1 Write failing route tests for `/api/solve` and `/api/score/comment`
    - Add tests to `src/server/__tests__/leaderboard-routes.test.ts`:
      - `POST /api/solve` with `unranked: true` persists the solve hash with `unranked: "true"` and produces no sorted-set membership
      - `POST /api/solve` with `unranked: false` persists the solve hash with `unranked: "false"` and both sorted sets contain `userId`
      - `POST /api/solve` with `unranked: "true"` (string) returns 400 with the validator error surfaced in the body
      - `POST /api/solve` with `unranked` omitted treats it as `false` (backwards compatibility)
      - `GET /api/leaderboard/post` response entries include `unranked: boolean` and `rank: number | null`
      - When the requesting user has only an unranked solve, `GET /api/leaderboard/post` returns `userEntry.rank === null` and `userEntry.unranked === true`
    - Add tests to `src/server/__tests__/score-comment-routes.test.ts`:
      - `POST /api/score/comment` forwards `unranked` from the parsed body into `formatScoreComment`; output comment includes the `"🏁 Unranked"` row when the body says `unranked: true`
      - `POST /api/score/comment` with `unranked: true` still posts the comment when other fields are valid (no extra rejection)
    - Run `bun run test` — new tests should fail
    - _Requirements: 8.1, 8.2, 9.1, 9.2, 9.3, 11.4, 11.5_

  - [x] 7.2 Update `POST /api/solve` and `POST /api/score/comment` handlers in `src/server/index.ts`
    - In `POST /api/solve`, destructure `unranked` from the `validateSolveInput` result and forward it into `recordSolve`; let the `SolveResponse` carry `postRank`/`globalRank` through as `number | null`
    - In `POST /api/score/comment`, destructure `unranked` from the parsed body and forward it into `formatScoreComment`
    - Do not add any community-puzzle-specific branches — the same code path covers standard and community rounds per Requirement 13
    - Run `bun run test` — route tests should pass
    - _Requirements: 8.1, 8.2, 13.3, 13.4_

- [x] 8. Checkpoint — Ensure all server tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add pause + background state and handlers to `src/client/App.svelte`
  - [x] 9.1 Add state, handlers, and lifecycle wiring for pause and backgrounding
    - Add `let isPaused: boolean = $state(false)`, `let unrankedDueToBackground: boolean = $state(false)`, and `let pauseButtonEl: HTMLButtonElement | null = $state(null)`
    - Import `initialPauseState`, `reduce`, and the `PauseEvent` type from `./lib/pause-reducer`
    - Implement `handlePause` — early-return when `screen !== 'playing'` or `isPaused`; otherwise `clearInterval(timerInterval)`, null it out, and set `isPaused = true`
    - Implement `handleResume` — early-return when `!isPaused`; otherwise set `isPaused = false` and call `startTimer()` so `elapsedSeconds` continues from its preserved value (the existing `startTimer` resets to 0 in `resetRoundState`; for resume, restart the interval without zeroing — extract a `tickTimer` helper if needed so `startTimer` keeps its zeroing contract while resume uses the helper)
    - Implement `onVisibilityChange` — early-return when `screen !== 'playing'`; if `document.hidden`, clear `timerInterval` and set `unrankedDueToBackground = true`; else if `!isPaused && timerInterval === null`, restart the interval via the same helper used by resume
    - Implement `onPageHide` — early-return when `screen !== 'playing'`; clear `timerInterval` and set `unrankedDueToBackground = true`
    - In `onMount`, `addEventListener('visibilitychange', onVisibilityChange)` on `document` and `addEventListener('pagehide', onPageHide)` on `window`; return a cleanup function that removes both with the same function references
    - Use the pause-reducer as the source of truth for transition legality (the Svelte handlers call `reduce(currentState, event)` and assign the returned flags back) so the App layer is a thin adapter around the pure reducer
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.3, 4.4, 4.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 7.4, 7.5, 7.6, 13.1, 13.2, 13.5_

  - [x] 9.2 Extend `resetRoundState` in `src/client/App.svelte`
    - Add `isPaused = false` and `unrankedDueToBackground = false` to the existing reset block alongside selection/notesBoard/hintsUsed/mistakesCount/notesUsed resets
    - Do NOT re-register the `visibilitychange` / `pagehide` listeners — they are owned by `onMount` lifecycle
    - Confirm `startTimer()` already resets `elapsedSeconds` to `0` and restarts the interval
    - _Requirements: 7.1, 7.2, 7.3, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

  - [x] 9.3 Extend `POST /api/solve` and `POST /api/score/comment` bodies in `src/client/App.svelte`
    - Add `unranked: unrankedDueToBackground` to the `checkCompletion` fetch body
    - Add `unranked: unrankedDueToBackground` to the `handleScoreComment` fetch body
    - Leave `notesUsed` field and all other existing fields untouched
    - _Requirements: 7.7, 8.1, 8.2, 8.6, 13.3, 13.4_

  - [x] 9.4 Render the Pause button in the header row of `src/client/App.svelte`
    - Place inside the header block adjacent to the timer display, gated by `{#if screen === 'playing'}` so it does not render on `"completed"` / `"submit"`
    - Attributes: `aria-label="Pause solve"`, `bind:this={pauseButtonEl}`, `onclick={handlePause}`
    - `disabled={loading || error !== null || isPaused}` so the control is disabled while loading, errored, or already paused
    - Inner content: a single `<span aria-hidden="true">⏸</span>` glyph; no text label, no `title`, no tooltip
    - After resume, call `pauseButtonEl?.focus()` inside `handleResume` so keyboard focus returns to the Pause button
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.7, 4.5_

- [x] 10. Create the Pause overlay component
  - [x] 10.1 Implement `src/client/components/PauseOverlay.svelte`
    - Props: `{ onResume: () => void }`
    - Root element: `<div role="dialog" aria-modal="true" aria-label="Solve paused">` with `absolute inset-0` positioning, `backdrop-blur-md bg-neutral-900/70` for the scrim (effective 70% opacity, inside the 60–95% band), and a high z-index so pointer and keyboard input cannot reach the grid underneath
    - Centered `<button>` with text `Resume`, receives focus on mount
    - Click on any part of the overlay (including the backdrop) invokes `onResume`; stop propagation on pointer events so they do not leak to the grid
    - Register an `Escape` keydown listener on `window` on mount and remove it on unmount; invoke `onResume` when fired
    - Keep focus inside the overlay while mounted (tab cycles back to the Resume button via a sentinel wrapper)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.1, 4.2, 4.4, 5.3_

  - [x] 10.2 Mount `PauseOverlay` conditionally from `src/client/App.svelte`
    - Import `PauseOverlay` from `./components/PauseOverlay.svelte`
    - Render `<PauseOverlay onResume={handleResume} />` wrapped in `{#if isPaused}` inside the grid container so its absolute positioning covers the `Grid.svelte` bounding box
    - Do NOT render it when `unrankedDueToBackground === true` and `isPaused === false` — backgrounding never mounts the overlay
    - Ensure difficulty tabs and the header timer remain outside the overlay's bounding box per design §Components
    - _Requirements: 3.1, 3.2, 3.3, 6.9_

- [x] 11. Gate `NumberPad.svelte` controls while paused
  - [x] 11.1 Add `isPaused` prop to `src/client/components/NumberPad.svelte` and OR it into every action's `disabled` expression
    - Add `isPaused: boolean` to the component props with default `false`
    - Update the disabled expressions per the table in design §Components and Interfaces:
      - Normal/Candidate toggle: `disabled={isPaused}`
      - Undo: `disabled={undoDisabled || isPaused}`
      - Hint: `disabled={hintsDisabled || isPaused}`
      - Leaderboard: `disabled={isPaused}`
      - Digit buttons 1–9: `disabled={isPaused}`
      - Erase: `disabled={isPaused}`
      - Auto Candidate checkbox: `disabled={isPaused}`
      - Digit First checkbox: `disabled={isPaused}`
      - Submit Puzzle (community path): `disabled={isPaused}`
    - Reuse the existing `cursor-not-allowed opacity-40` Tailwind classes for visual consistency
    - Pass `isPaused={isPaused}` from `src/client/App.svelte` at the `<NumberPad>` call site
    - Additionally in `src/client/App.svelte`, intercept the existing global keydown handler early when `isPaused === true` so that keyboard shortcuts which would modify Board, Notes, Selection, Undo_Stack, or Hint_State become no-ops; the `Escape` key is the sole exception and should be allowed to reach the overlay's resume handler
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 12. Render the unranked user entry in `src/client/components/Leaderboard.svelte`
  - [x] 12.1 Update `src/client/components/Leaderboard.svelte` for unranked entries
    - Widen the local `LeaderboardEntry` type: `rank: number | null`, `unranked: boolean`, keep `notesUsed: boolean | undefined`
    - When `userEntry.unranked === true`, render an em dash (`—`) in the rank column instead of a number
    - Append a pill badge next to the username using `<span class="ml-2 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">unranked</span>`
    - Top-N rendering path is unchanged (the server filters unranked entries out of the sorted set, so `entries[].unranked` is always `false`)
    - Keep `colspan` on the divider row aligned with the current column count
    - _Requirements: 11.6_

- [x] 13. Final checkpoint — Ensure all tests pass and types check
  - Run `bun run test && bun run type-check`
  - Exit criterion: zero test failures and zero type errors
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirement clauses for traceability via `_Requirements: ..._` annotations
- Property tests use fast-check with a minimum of 100 iterations per property and live alongside their subject under `__tests__/*.property.test.ts`
- TDD discipline: every implementation sub-task has a preceding failing-test sub-task; run `bun run test` after writing tests (they must fail) and again after implementation (they must pass)
- Svelte components are adapters over pure logic — tests target `pause-reducer.ts`, `leaderboard.ts`, and `score-comment.ts`; `PauseOverlay.svelte`, `App.svelte`, `NumberPad.svelte`, and `Leaderboard.svelte` are covered transitively per AGENTS.md
- Community puzzle parity is achieved by keeping the same code path for both puzzle types; no community-specific branches in `App.svelte`, `index.ts`, or `leaderboard.ts`
- Checkpoints (tasks 8 and 13) ensure incremental validation — do not skip them
