# Tasks

## Task 1: Create leaderboard server library with pure functions and Redis operations

- [x] 1.1 Create `src/server/lib/leaderboard.ts` with `computeAdjustedTime`, `validateSolveInput`, and type definitions (`LeaderboardEntry`, `SolveResponse`, `LeaderboardResponse`)
- [x] 1.2 Implement `recordSolve` function: check duplicate via `redis.exists`, write solve hash, `zAdd` to per-post sorted set, conditionally `zAdd` to global sorted set (only if new or better score), return post and global ranks
- [x] 1.3 Implement `getLeaderboard` function: `zRange` top 10 by rank ascending, `hGetAll` for each solve record to build entries, include user entry with rank if logged in and outside top 10
- [x] 1.4 Write unit tests in `src/server/lib/__tests__/leaderboard.test.ts` for `computeAdjustedTime` (specific examples), `validateSolveInput` (valid/invalid inputs), `recordSolve` (success, duplicate rejection), and `getLeaderboard` (top 10, empty, user entry inclusion)
- [ ] 1.5 Write property tests in `src/server/lib/__tests__/leaderboard.property.test.ts`:
  - [x] 1.5.1 Property 1: Solve record round-trip — for any valid solve input, writing then reading back produces equivalent values
  - [x] 1.5.2 Property 2: Adjusted time computation — for any non-negative completionTime and hintsUsed, result equals completionTime + hintsUsed * 30
  - [x] 1.5.3 Property 3: Global leaderboard minimum — for any sequence of solves by the same user across posts, global score equals the minimum adjusted time
  - [x] 1.5.4 Property 4: Duplicate solve rejection — for any valid solve, a second submission is rejected and original data is unchanged
  - [x] 1.5.5 Property 5: Invalid input rejection — for any invalid numeric field (negative, float, string, null), validateSolveInput returns an error
  - [x] 1.5.6 Property 6: Leaderboard ordering — for any set of solves, returned entries are sorted ascending by adjustedTime with length ≤ 10

## Task 2: Add solve and leaderboard API routes

- [x] 2.1 Add `POST /api/solve` route to `src/server/index.ts`: validate input, guard `context.userId` and `context.postId`, verify board solution server-side (check `puzzle:{postId}` solution matches), call `recordSolve`, return `{ status: 'success', data: { postRank, globalRank, adjustedTime } }`
- [x] 2.2 Add `GET /api/leaderboard/post` route: parse `difficulty` query param, guard `context.postId`, call `getLeaderboard` with per-post key, wrap with `cache()` (TTL ~10s), return response
- [x] 2.3 Add `GET /api/leaderboard/global` route: parse `difficulty` query param, call `getLeaderboard` with global key, wrap with `cache()` (TTL ~10s), return response
- [x] 2.4 Write unit tests in `src/server/__tests__/leaderboard-routes.test.ts` for all three routes: valid requests, invalid difficulty, missing auth, duplicate solve, empty leaderboard, user entry outside top 10

## Task 3: Add client-side mistakes tracking

- [x] 3.1 Add `mistakesCount` state to `App.svelte`, reset to 0 in `resetRoundState`
- [x] 3.2 Create `isMistake` pure function in `src/client/lib/app-logic.ts` that compares a placed digit against the solution for a given cell position
- [x] 3.3 Integrate mistake detection into digit placement flow in `App.svelte`: after placing a digit in non-notes mode, check against solution and increment `mistakesCount` if mismatch
- [ ] 3.4 Write property test in `src/client/lib/__tests__/leaderboard.property.test.ts`:
  - [x] 3.4.1 Property 7: Mistakes increment only on solution mismatch — for any cell and digit, isMistake returns true iff digit ≠ solution[cell]

## Task 4: Integrate solve submission into completion flow

- [x] 4.1 Modify `checkCompletion` in `App.svelte` to call `POST /api/solve` with `difficulty`, `elapsedSeconds`, `hintsUsed`, and `mistakesCount` after successful validation
- [x] 4.2 Add `solveResult` state (`{ postRank, globalRank, adjustedTime } | null`) to `App.svelte`, set from solve response
- [x] 4.3 Handle solve submission errors gracefully: still show completion screen even if solve recording fails, show error toast if submission fails

## Task 5: Create Leaderboard UI component

- [x] 5.1 Create `src/client/components/Leaderboard.svelte` with props: `difficulty`, `currentUsername`, `mode` ('panel' | 'completion')
- [x] 5.2 Implement fetch-on-mount for leaderboard data with loading/error/empty states, toggle between per-post and global views
- [x] 5.3 Render leaderboard table: rank, username, completion time (formatted), hints used, mistakes count, adjusted time; highlight current user's row; show star/badge icon for zero-hint entries
- [x] 5.4 In `completion` mode: display user's stats (time, hints, mistakes, rank) prominently above the leaderboard table

## Task 6: Integrate leaderboard into game screens

- [x] 6.1 Add leaderboard button/tab to the playing screen in `App.svelte` with `showLeaderboard` toggle state; timer continues while panel is open
- [x] 6.2 Render `Leaderboard` component in a panel/overlay when `showLeaderboard` is true during gameplay
- [x] 6.3 Replace the current completion screen in `App.svelte` with an enhanced version that includes the `Leaderboard` component in `completion` mode, showing the user's solve result and per-post leaderboard with toggle to global
