# Tasks: Game Settings Controls

## Task List

- [x] 1. Add ErrorMode type and computeCollisionConflicts to sudoku-utils.ts
  - [x] 1.1 Export `ErrorMode` type (`'error-highlight' | 'collision-only'`) from `types.ts`
  - [x] 1.2 Write failing unit tests for `computeCollisionConflicts` in `src/client/lib/__tests__/sudoku-utils.test.ts`
  - [x] 1.3 Write failing property tests for `computeCollisionConflicts` in `src/client/lib/__tests__/sudoku-utils.property.test.ts`
  - [x] 1.4 Implement `computeCollisionConflicts` in `sudoku-utils.ts` (pure, no mutation, same peer-check logic as `hasConflict`)
  - [x] 1.5 Verify all new tests pass: `bun run test`

- [x] 2. Add pause state and handlers to App.svelte
  - [x] 2.1 Add `isPaused: boolean` state (default `false`) to `App.svelte`
  - [x] 2.2 Implement `handlePause` — sets `isPaused = true`, clears timer interval
  - [x] 2.3 Implement `handleResume` — sets `isPaused = false`, restarts timer interval from current `elapsedSeconds`
  - [x] 2.4 Gate all game interactions in `handleKeyDown` behind `if (isPaused) return`
  - [x] 2.5 Clear `isPaused` in `resetRoundState` (called on new puzzle / difficulty change)
  - [x] 2.6 Clear `isPaused` in `checkCompletion` when game completes

- [ ] 3. Add timer visibility toggle to App.svelte
  - [ ] 3.1 Add `timerVisible: boolean` state (default `true`) to `App.svelte`
  - [ ] 3.2 Implement `handleToggleTimer` — flips `timerVisible`
  - [ ] 3.3 Reset `timerVisible = true` in `resetRoundState`
  - [ ] 3.4 Update timer display in template: show formatted time when `timerVisible`, show same-height placeholder `div` when hidden

- [ ] 4. Add error mode toggle to App.svelte
  - [ ] 4.1 Add `errorMode: ErrorMode` state (default `'error-highlight'`) to `App.svelte`
  - [ ] 4.2 Implement `handleToggleErrorMode` — flips `errorMode`, immediately calls `recomputeConflicts(board, errorMode)` and assigns result to `board`
  - [ ] 4.3 Add inline `recomputeConflicts` helper that dispatches to `updateConflicts` or `computeCollisionConflicts` based on `errorMode`
  - [ ] 4.4 Replace all direct `updateConflicts(board)` calls in App.svelte with `recomputeConflicts(board, errorMode)` so the active mode is always respected
  - [ ] 4.5 Reset `errorMode = 'error-highlight'` in `resetRoundState`

- [ ] 5. Add pause overlay to App.svelte template
  - [ ] 5.1 Render a full-screen overlay `div` (absolute, covers grid area) when `isPaused === true`
  - [ ] 5.2 Overlay contains a single resume button that calls `handleResume`
  - [ ] 5.3 Overlay uses `pointer-events-auto` and sits above the grid via `z-index` so it blocks all grid interactions

- [ ] 6. Update NumberPad.svelte with new controls
  - [ ] 6.1 Add props: `isPaused`, `timerVisible`, `errorMode`, `onPause`, `onToggleTimer`, `onToggleErrorMode`
  - [ ] 6.2 Add pause/resume icon button (⏸ when playing, ▶ when paused) to the top icon-button row alongside Undo and Hint
  - [ ] 6.3 Add "Show Timer" checkbox to the checkboxes row (checked = `timerVisible`)
  - [ ] 6.4 Add "Collision Only" checkbox to the checkboxes row (checked = `errorMode === 'collision-only'`)
  - [ ] 6.5 Pass new props and handlers from `App.svelte` to `NumberPad`

- [ ] 7. Verify and type-check
  - [ ] 7.1 Run `bun run test` — zero failures
  - [ ] 7.2 Run `bun run type-check` — zero errors
