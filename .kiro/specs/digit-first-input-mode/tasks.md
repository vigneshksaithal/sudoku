# Implementation Plan: Digit-First Input Mode

## Overview

Add a digit-first input mode to the Sudoku game. The player locks a digit on the number pad, then taps cells to place it — the inverse of the existing cell-first flow. Implementation follows a bottom-up approach: types → pure logic → tests → UI wiring.

## Tasks

- [x] 1. Add InputMode type and placeLockedDigit pure function
  - [x] 1.1 Add `InputMode` type to `src/client/lib/types.ts`
    - Export `type InputMode = 'cell-first' | 'digit-first'`
    - _Requirements: 1.1, 1.3_

  - [x] 1.2 Add `placeLockedDigit` function to `src/client/lib/app-logic.ts`
    - Import `clearCellNotes`, `cleanupNotes` from `notes-utils`
    - Guard: return `false` if row/col out of bounds, cell is given, or cell is undefined
    - Set `board[row][col].value = digit`
    - Call `clearCellNotes` and `cleanupNotes` for the placed digit
    - Return `true` if placement occurred, `false` if skipped
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Write unit tests for placeLockedDigit
  - [x] 2.1 Add unit tests in `src/client/lib/__tests__/app-logic.test.ts`
    - Test: place digit into empty non-given cell → cell value equals digit, returns true
    - Test: place digit into given cell → returns false, cell unchanged
    - Test: place digit into cell with existing value → overwrites value, returns true
    - Test: place digit clears cell notes and removes digit from peer notes
    - Test: out-of-bounds row/col → returns false
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Checkpoint - Verify pure logic
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Write property tests for digit-first logic
  - [ ]* 4.1 Property 1: Input mode toggle is an involution
    - **Property 1: Input mode toggle is an involution**
    - Generate random InputMode values, toggle twice, assert original value restored
    - **Validates: Requirements 1.2**

  - [ ]* 4.2 Property 3: Digit locking toggle in digit-first mode
    - **Property 3: Digit locking toggle in digit-first mode**
    - Generate random current lockedDigit (null or 1–9) and random digit (1–9). Apply locking logic. Assert lockedDigit equals new digit if different, or null if same.
    - **Validates: Requirements 2.1, 2.2, 2.4, 7.2**

  - [ ]* 4.3 Property 5: Digit-first placement into empty non-given cells
    - **Property 5: Digit-first placement into empty non-given cells**
    - Generate random valid boards with empty non-given cells and random digits 1–9. Call `placeLockedDigit`. Assert cell value equals the digit.
    - **Validates: Requirements 3.1**

  - [ ]* 4.4 Property 6: Given and filled cells are immutable under digit-first actions
    - **Property 6: Given and filled cells are immutable under digit-first actions**
    - Generate random boards and random given/filled cells. Attempt digit-first placement. Assert cell value and notes are unchanged.
    - **Validates: Requirements 3.2, 4.2, 4.3**

  - [ ]* 4.5 Property 7: Placement clears cell notes and cleans up peer notes
    - **Property 7: Placement clears cell notes and cleans up peer notes**
    - Generate random boards with empty cells and random digits. Place digit via `placeLockedDigit`. Assert cell notes are empty and no peer has the digit in notes.
    - **Validates: Requirements 3.3**

  - [ ]* 4.6 Property 9: Digit-first note toggling
    - **Property 9: Digit-first note toggling**
    - Generate random boards with empty non-given cells, random digits, and random initial note states. Call `toggleNote`. Assert the digit is present in notes iff it was absent before.
    - **Validates: Requirements 4.1**

  - [ ]* 4.7 Property 11: Undo round-trip for digit-first actions
    - **Property 11: Undo round-trip for digit-first actions**
    - Generate random boards and notes. Capture snapshot, perform `placeLockedDigit`, undo via `restoreNotesBoard`. Assert board and notes match original.
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 4.8 Property 12: Erase preserves locked digit
    - **Property 12: Erase preserves locked digit**
    - Generate random locked digits and simulate erase. Assert lockedDigit value is unchanged after erase.
    - **Validates: Requirements 7.3, 8.1**

- [x] 5. Checkpoint - Verify all property tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Wire digit-first state and handlers into App.svelte
  - [x] 6.1 Add `inputMode` and `lockedDigit` state to `src/client/App.svelte`
    - Add `let inputMode: InputMode = $state('cell-first')`
    - Add `let lockedDigit: number | null = $state(null)`
    - Import `InputMode` from `types.ts` and `placeLockedDigit` from `app-logic.ts`
    - _Requirements: 1.3_

  - [x] 6.2 Add `handleToggleInputMode` handler
    - Toggle between `cell-first` and `digit-first`
    - When switching to `cell-first`, clear `lockedDigit` to null
    - _Requirements: 1.2, 1.4_

  - [x] 6.3 Modify `resetRoundState` to reset digit-first state
    - Set `inputMode = 'cell-first'` and `lockedDigit = null`
    - _Requirements: 1.3_

  - [x] 6.4 Modify `handleNumber` for digit-first mode
    - In digit-first mode: set `lockedDigit` to the digit, or clear to null if same digit already locked
    - Set `highlightDigit` to the locked digit value
    - Preserve existing cell-first behavior when `inputMode === 'cell-first'`
    - _Requirements: 2.1, 2.2, 2.4, 5.2, 9.1_

  - [x] 6.5 Modify `handleCellSelect` for digit-first mode
    - Always set selection (existing behavior)
    - In digit-first mode with a locked digit and no notes mode: push undo snapshot, call `placeLockedDigit`, call `updateConflicts`, call `checkCompletion`
    - In digit-first mode with a locked digit and notes mode active: push undo snapshot, call `toggleNote`
    - In digit-first mode with no locked digit: just select (same as cell-first)
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 6.1, 6.2_

  - [x] 6.6 Modify `handleErase` for digit-first mode
    - In digit-first mode: erase focused cell value without clearing `lockedDigit`
    - Preserve existing cell-first behavior when `inputMode === 'cell-first'`
    - _Requirements: 8.1, 8.2_

  - [x] 6.7 Modify `handleKeyDown` for digit-first mode
    - Escape: clear `lockedDigit` if set, otherwise clear selection (existing)
    - Digit keys (1–9): update `lockedDigit` (set or toggle off) instead of placing
    - Arrow keys: move focus and auto-place locked digit into newly focused cell (or toggle note in notes mode)
    - Backspace/Delete: erase focused cell without clearing `lockedDigit`
    - _Requirements: 2.3, 7.1, 7.2, 7.3_

  - [x] 6.8 Pass new props to NumberPad component
    - Pass `inputMode`, `lockedDigit`, and `onToggleInputMode` to NumberPad
    - _Requirements: 1.1, 5.1_

- [x] 7. Modify NumberPad.svelte for digit-first UI
  - [x] 7.1 Add new props to `src/client/components/NumberPad.svelte`
    - Add `inputMode: InputMode`, `lockedDigit: number | null`, `onToggleInputMode: () => void` props
    - Import `InputMode` type from `types.ts`
    - _Requirements: 1.1, 5.1_

  - [x] 7.2 Add input mode toggle control
    - Add a segmented button or switch below the Normal/Candidate tabs for cell-first / digit-first toggle
    - Wire `onclick` to `onToggleInputMode`
    - Style active state to match existing tab pattern
    - _Requirements: 1.1_

  - [x] 7.3 Add locked digit visual styling to digit buttons
    - When `lockedDigit` matches a digit button, apply distinct active style (e.g., `ring-2 ring-blue-500 bg-blue-100`)
    - Locked digit style takes precedence over solved-digit fading
    - When `lockedDigit` is null, all buttons use default styling
    - _Requirements: 5.1, 5.3, 2.5_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Run `bun run test && bun run type-check`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Grid.svelte requires no changes — it already emits pointer events that App.svelte handles
- The `placeLockedDigit` function extracts placement logic into a reusable pure function for both cell-first and digit-first paths