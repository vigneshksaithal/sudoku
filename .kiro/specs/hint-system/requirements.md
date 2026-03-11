# Requirements Document

## Introduction

The hint system allows Sudoku players to request assistance when stuck. Each hint reveals the correct value for the most strategically useful empty cell (the one with the fewest remaining candidates), highlights it briefly, and decrements a per-session counter. Hints are capped at a configurable maximum (3 by default). The feature requires extending the `/api/puzzle` response to include solution strings and adding pure hint-logic functions on the client.

## Glossary

- **Hint_System**: The client-side subsystem that manages hint requests, hint-cell selection, and hint-count enforcement.
- **Hint_Logic**: The pure functions in `hint-logic.ts` responsible for selecting the best hint cell (`getBestHintCell`) and validating applicability (`isHintApplicable`).
- **NumberPad**: The `NumberPad.svelte` component that renders digit buttons, erase, notes toggle, and the hint button.
- **Grid**: The `Grid.svelte` component that renders the 9×9 board and applies per-cell highlight classes.
- **App**: The `App.svelte` root component that owns game state, hint counter, and hint handler.
- **API**: The Hono server route `/api/puzzle` that returns puzzle and solution data.
- **Board**: The 9×9 `CellState[][]` reactive state representing the current puzzle.
- **Solution**: A flat 81-element array of digits 1–9 representing the complete, correct answer for the current puzzle.
- **HintCell**: A `{ row, col, value }` object identifying the cell selected for a hint and the correct digit to place.
- **MAX_HINTS**: The configurable upper bound on hints per session (default: 3).
- **hintsUsed**: The count of hints consumed in the current session (0–MAX_HINTS).
- **hintsRemaining**: `MAX_HINTS - hintsUsed`, derived reactively.
- **Peer**: Any cell in the same row, column, or 3×3 box as a given cell.
- **Given cell**: A pre-filled cell that is part of the original puzzle and cannot be modified.
- **Empty cell**: A cell whose `value === 0` and `isGiven === false`.

## Requirements

### Requirement 1: Hint Button UI

**User Story:** As a player, I want to see a hint button with a remaining-count label, so that I know how many hints I have left and can request one when I am stuck.

#### Acceptance Criteria

1. THE NumberPad SHALL render a "Hint" button that displays the current `hintsRemaining` count (e.g. "Hint (3)").
2. WHEN `hintsRemaining === 0`, THE NumberPad SHALL render the hint button in a disabled state.
3. WHILE `screen !== 'playing'`, THE NumberPad SHALL render the hint button in a disabled state.
4. WHEN `solutions` has not yet been loaded, THE NumberPad SHALL render the hint button in a disabled state.
5. WHEN the hint button is in a disabled state, THE NumberPad SHALL apply distinct visual styling to differentiate it from an enabled button.

---

### Requirement 2: Best-Cell Selection

**User Story:** As a player, I want the hint to reveal the most useful cell, so that the hint teaches me something about solving technique rather than picking arbitrarily.

#### Acceptance Criteria

1. WHEN `getBestHintCell` is called with a board that has at least one empty non-given cell, THE Hint_Logic SHALL return the empty non-given cell with the fewest valid digit candidates.
2. WHEN `getBestHintCell` is called with a board where all cells are filled, THE Hint_Logic SHALL return `null`.
3. WHEN `getBestHintCell` returns a non-null `HintCell`, THE Hint_Logic SHALL ensure `result.value === solution[result.row * 9 + result.col]`.
4. WHEN `getBestHintCell` returns a non-null `HintCell`, THE Hint_Logic SHALL ensure the referenced cell satisfies `value === 0` and `isGiven === false`.
5. IF two or more empty non-given cells share the minimum candidate count, THEN THE Hint_Logic SHALL return the one with the lowest cell index (`row * 9 + col`).

---

### Requirement 3: Hint Application

**User Story:** As a player, I want the hint to be applied to the board immediately and cleanly, so that the game state remains consistent after I use a hint.

#### Acceptance Criteria

1. WHEN a hint is applied, THE App SHALL place `hint.value` into `board[hint.row][hint.col]`.
2. WHEN a hint is applied, THE App SHALL increment `hintsUsed` by exactly 1.
3. WHEN a hint is applied, THE App SHALL clear all notes for the hinted cell.
4. WHEN a hint is applied, THE App SHALL remove `hint.value` from the notes of every peer of the hinted cell.
5. WHEN a hint is applied, THE App SHALL recalculate conflicts across the entire board via `updateConflicts`.
6. WHEN a hint is applied, THE App SHALL call `checkCompletion` to detect if the puzzle is now solved.

---

### Requirement 4: Hint Highlight

**User Story:** As a player, I want the hinted cell to be briefly highlighted, so that I can immediately see which cell was filled in.

#### Acceptance Criteria

1. WHEN a hint is applied, THE App SHALL set `hintCell` to `{ row: hint.row, col: hint.col }`.
2. WHEN `hintCell` is non-null, THE Grid SHALL apply a distinct amber/orange highlight class to that cell.
3. WHEN 1500 ms have elapsed after a hint is applied, THE App SHALL set `hintCell` to `null`.
4. WHILE `hintCell` is non-null, THE Grid SHALL give the hint highlight visual precedence over the selection highlight.

---

### Requirement 5: Hint Cap Enforcement

**User Story:** As a game designer, I want hints to be limited per session, so that the game remains a meaningful challenge.

#### Acceptance Criteria

1. THE App SHALL enforce a maximum of `MAX_HINTS` hints per session.
2. WHEN `hintsUsed >= MAX_HINTS`, THE App SHALL prevent `handleHint` from executing any side effects.
3. WHEN `hintsUsed >= MAX_HINTS`, THE NumberPad SHALL render the hint button in a disabled state.
4. THE App SHALL ensure `hintsUsed` never exceeds `MAX_HINTS` regardless of how many times `handleHint` is invoked.

---

### Requirement 6: Solution Delivery via API

**User Story:** As a developer, I want the puzzle API to return solution strings alongside puzzle strings, so that the client can perform hint-cell selection without a separate request.

#### Acceptance Criteria

1. WHEN the API handles a `GET /api/puzzle` request, THE API SHALL include a `solutions` field in the response body alongside the existing `puzzles` field.
2. THE API SHALL return one solution string per difficulty level, each being an 81-character string of digits 1–9 with no zeros.
3. WHEN the client receives the API response, THE App SHALL store `data.solutions` in the `solutions` reactive state.
4. IF the API response does not include a `solutions` field, THEN THE App SHALL leave `solutions` as `null` and disable the hint button.

---

### Requirement 7: Hint Applicability Validation

**User Story:** As a developer, I want a pure validation function that confirms a hint can be applied to a specific cell, so that hint logic is testable in isolation.

#### Acceptance Criteria

1. WHEN `isHintApplicable` is called with a given cell, THE Hint_Logic SHALL return `false`.
2. WHEN `isHintApplicable` is called with a filled (non-zero) cell, THE Hint_Logic SHALL return `false`.
3. WHEN `isHintApplicable` is called with an empty non-given cell and a valid solution value (1–9), THE Hint_Logic SHALL return `true`.
4. WHEN `getBestHintCell` returns a non-null `HintCell { row, col, value }`, THE Hint_Logic SHALL ensure `isHintApplicable(board, row, col, value)` returns `true`.
5. THE Hint_Logic SHALL ensure `isHintApplicable` produces no mutations to the board or any other state.

---

### Requirement 8: Error and Edge-Case Handling

**User Story:** As a player, I want the hint system to degrade gracefully in unexpected situations, so that the game remains playable even if hints are unavailable.

#### Acceptance Criteria

1. IF `solutions` is `null` when a hint is requested, THEN THE App SHALL return from `handleHint` without modifying any state.
2. IF `getBestHintCell` returns `null` when a hint is requested, THEN THE App SHALL return from `handleHint` without modifying any state.
3. IF the API response is missing the `solutions` field, THEN THE App SHALL remain fully playable without hints.
4. WHEN a hint places a value that conflicts with existing peer values, THE App SHALL still apply the hint and display the conflict via the existing conflict-highlight mechanism.
