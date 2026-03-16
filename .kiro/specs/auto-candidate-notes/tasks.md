# Implementation Plan: Auto Candidate Notes

## Overview

Add an "Auto Candidate" button to the Sudoku number pad that computes valid candidates for all empty cells and writes them to the notes board, with undo support. The implementation builds the core logic first, wires it into the UI, then connects undo integration.

## Tasks

- [x] 1. Implement `applyAutoCandidates` in app-logic.ts
  - [x] 1.1 Add the `applyAutoCandidates` function to `src/client/lib/app-logic.ts`
    - Import `buildCandidateBoard` from `technique-hints/candidate-board`
    - Implement the function: call `buildCandidateBoard(board)` (without notes param) to get pure constraint-based candidates
    - For each cell where `value === 0` and `isGiven === false`: clear existing notes, then add all computed candidate digits
    - Skip given cells and filled cells entirely (leave their notes unchanged)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2_

  - [x] 1.2 Write property test: Candidate correctness (Property 1)
    - **Property 1: Candidate correctness**
    - For any valid board and any empty non-given cell, after `applyAutoCandidates`, the cell's notes contain exactly the digits 1–9 not present in the cell's row, column, or box
    - Add to `src/client/lib/__tests__/app-logic.property.test.ts`
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [x] 1.3 Write property test: Non-empty cells unchanged (Property 2)
    - **Property 2: Non-empty cells unchanged**
    - For any valid board, after `applyAutoCandidates`, notes for given cells and filled cells are identical to their pre-operation state
    - Add to `src/client/lib/__tests__/app-logic.property.test.ts`
    - **Validates: Requirements 2.1, 2.2**

  - [x] 1.4 Write property test: Board immutability (Property 3)
    - **Property 3: Board immutability**
    - For any valid board, after `applyAutoCandidates`, every cell's `value`, `isGiven`, and `hasConflict` fields are identical to before
    - Add to `src/client/lib/__tests__/app-logic.property.test.ts`
    - **Validates: Requirement 1.4**

  - [x] 1.5 Write property test: Idempotency (Property 5)
    - **Property 5: Idempotency**
    - For any valid board, applying `applyAutoCandidates` twice without board changes produces the same notes state as applying once
    - Add to `src/client/lib/__tests__/app-logic.property.test.ts`
    - **Validates: Requirement 5.1**

  - [x] 1.6 Write unit tests for `applyAutoCandidates` edge cases
    - Test fully solved board produces no notes changes (Requirement 6.1)
    - Test board with conflicting values computes candidates based on current state (Requirement 6.2)
    - Test completely empty board sets all cells to {1..9} (Requirement 6.3)
    - Test that existing notes on empty cells are replaced, not merged
    - Add to `src/client/lib/__tests__/app-logic.test.ts`
    - _Requirements: 6.1, 6.2, 6.3, 1.3_

- [x] 2. Checkpoint - Verify core logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Add Auto Candidate button to NumberPad
  - [x] 3.1 Update `src/client/components/NumberPad.svelte` to accept and render the Auto Candidate button
    - Add `onAutoCandidate` callback prop and `autoCandidateDisabled` boolean prop
    - Render an `IconButton` in the action column with label "Auto" and an appropriate icon
    - Disable the button when `autoCandidateDisabled` is true
    - Ensure the button has an accessible label describing its purpose
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 4. Wire auto-candidate handler in App.svelte
  - [x] 4.1 Add `handleAutoCandidate` handler in `src/client/App.svelte`
    - Import `applyAutoCandidates` from `app-logic`
    - Implement handler: guard on `screen !== 'playing'`, push undo snapshot, call `applyAutoCandidates(board, notesBoard)`
    - Pass `onAutoCandidate={handleAutoCandidate}` and `autoCandidateDisabled={screen !== 'playing'}` to NumberPad
    - _Requirements: 3.1, 3.2, 4.3_

  - [x] 4.2 Write property test: Undo round-trip (Property 4)
    - **Property 4: Undo round-trip**
    - For any valid board and notes state, capturing a snapshot, applying `applyAutoCandidates`, then restoring the snapshot produces notes identical to the original
    - Add to `src/client/lib/__tests__/app-logic.property.test.ts`
    - **Validates: Requirement 3.2**

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses Vitest with fast-check for property-based testing
