# Requirements Document

## Introduction

This document defines the requirements for the Auto Candidate Notes feature in the Sudoku application. The feature adds an "Auto Candidate" button to the number pad that computes all valid candidate digits for every empty cell on the board and populates the notes board in a single action. It leverages the existing `buildCandidateBoard` utility for constraint-based candidate computation and integrates with the undo stack for reversibility.

## Glossary

- **Number_Pad**: The UI component (`NumberPad.svelte`) containing digit buttons (1–9) and action buttons (Undo, Notes, Hint, Erase, Alignment) used to interact with the Sudoku board.
- **Auto_Candidate_Button**: A new action button within the Number_Pad that triggers the auto-candidate computation.
- **App_Controller**: The root Svelte component (`App.svelte`) that orchestrates game state, user actions, and component wiring.
- **Candidate_Engine**: The `applyAutoCandidates` pure function in `app-logic.ts` that computes and writes valid candidates into the notes board.
- **Candidate_Board_Builder**: The existing `buildCandidateBoard` function in `candidate-board.ts` that computes valid candidate digits per cell based on Sudoku constraints (row, column, box).
- **Notes_Board**: A 9×9 grid of mutable sets (`SvelteSet<number>[][]`) storing pencil-mark notes per cell.
- **Undo_Stack**: The snapshot-based undo mechanism that captures board and notes state before destructive operations.
- **Empty_Cell**: A cell where `value === 0` and `isGiven === false`.
- **Given_Cell**: A cell where `isGiven === true`, representing a puzzle clue that cannot be modified.
- **Filled_Cell**: A cell where `value !== 0`, including both given cells and user-entered values.
- **Peer_Cells**: All cells sharing the same row, column, or 3×3 box as a given cell.

## Requirements

### Requirement 1: Compute and Apply Auto Candidates

**User Story:** As a Sudoku player, I want to automatically fill in all valid candidate notes for every empty cell, so that I can focus on solving techniques rather than manual pencil-marking.

#### Acceptance Criteria

1. WHEN the user clicks the Auto_Candidate_Button, THE Candidate_Engine SHALL compute valid candidates for every Empty_Cell using the Candidate_Board_Builder and write them into the Notes_Board
2. WHEN computing candidates for an Empty_Cell, THE Candidate_Engine SHALL include exactly the digits from 1–9 that do not appear in the cell's Peer_Cells
3. WHEN writing candidates to an Empty_Cell, THE Candidate_Engine SHALL replace any existing notes on that cell with the computed candidates
4. WHEN the auto-candidate operation completes, THE Candidate_Engine SHALL leave the board cell values unchanged

### Requirement 2: Preserve Given and Filled Cells

**User Story:** As a Sudoku player, I want the auto-candidate operation to leave given clues and filled cells untouched, so that my progress is not disrupted.

#### Acceptance Criteria

1. WHEN the auto-candidate operation processes a Given_Cell, THE Candidate_Engine SHALL leave the Notes_Board entry for that cell unchanged
2. WHEN the auto-candidate operation processes a Filled_Cell, THE Candidate_Engine SHALL leave the Notes_Board entry for that cell unchanged

### Requirement 3: Undo Support

**User Story:** As a Sudoku player, I want to undo the auto-candidate operation with a single undo action, so that I can revert to my previous notes state if needed.

#### Acceptance Criteria

1. WHEN the user clicks the Auto_Candidate_Button, THE App_Controller SHALL push a snapshot of the current board, Notes_Board, and hints-used count onto the Undo_Stack before applying candidates
2. WHEN the user triggers undo after an auto-candidate operation, THE App_Controller SHALL restore the Notes_Board to the state captured before the auto-candidate operation

### Requirement 4: Auto Candidate Button in Number Pad

**User Story:** As a Sudoku player, I want a clearly labeled button on the number pad to trigger auto-candidate computation, so that the feature is discoverable and easy to use.

#### Acceptance Criteria

1. THE Number_Pad SHALL display an Auto_Candidate_Button in the action column with an icon and the label "Auto"
2. WHEN the game screen is not in the "playing" state, THE Number_Pad SHALL disable the Auto_Candidate_Button
3. WHEN the Auto_Candidate_Button is clicked, THE Number_Pad SHALL invoke the `onAutoCandidate` callback provided by the App_Controller
4. THE Auto_Candidate_Button SHALL have an accessible label describing its purpose

### Requirement 5: Idempotency

**User Story:** As a Sudoku player, I want repeated clicks of the auto-candidate button (without board changes) to produce the same result, so that the behavior is predictable.

#### Acceptance Criteria

1. WHEN the auto-candidate operation is applied twice in succession without any board changes, THE Candidate_Engine SHALL produce the same Notes_Board state as applying the operation once

### Requirement 6: Edge Case Handling

**User Story:** As a Sudoku player, I want the auto-candidate feature to behave correctly on boards in any state, so that I can use it at any point during gameplay.

#### Acceptance Criteria

1. WHEN the auto-candidate operation is applied to a fully solved board (no Empty_Cells), THE Candidate_Engine SHALL make no changes to the Notes_Board
2. WHEN the auto-candidate operation is applied to a board with conflicting user-entered values, THE Candidate_Engine SHALL compute candidates based on the current board state including the conflicting values
3. WHEN the auto-candidate operation is applied to a completely empty board (no Given_Cells, no user entries), THE Candidate_Engine SHALL set the candidates for every cell to the full set {1, 2, 3, 4, 5, 6, 7, 8, 9}
