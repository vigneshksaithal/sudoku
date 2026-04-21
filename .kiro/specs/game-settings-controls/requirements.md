# Requirements Document

## Introduction

This feature adds three player-facing game controls to the Sudoku app's playing screen:

1. A **pause button** that stops the timer and obscures the board, letting time-conscious players step away without revealing the puzzle.
2. A **hide/show timer toggle** for players who prefer a relaxed, untimed experience.
3. An **error-highlight mode toggle** that switches conflict detection from "always highlight wrong values" to "only highlight a cell when the same digit appears in the same row, column, or box" (collision-only errors).

All three controls are persistent within a game session and are surfaced in the existing `NumberPad` control area to avoid adding new vertical space to the constrained 512 px tall viewport.

## Glossary

- **App**: The Svelte 5 client application rendered inside the Devvit webview.
- **Board**: The 9×9 Sudoku grid displayed during the playing screen.
- **Collision**: A state where the same digit appears more than once in the same row, column, or 3×3 box.
- **Conflict**: A cell whose value is marked `hasConflict: true` in `CellState`.
- **Error-highlight mode**: The current behaviour — a filled cell is highlighted as wrong whenever its value does not match the solution (always-on error display).
- **Collision-only mode**: The alternative error behaviour — a filled cell is highlighted only when it causes a Collision, regardless of whether the value matches the solution.
- **NumberPad**: The `NumberPad.svelte` component containing digit buttons and auxiliary controls.
- **Paused state**: A game state where the timer is stopped and the Board is obscured by an overlay.
- **Timer**: The elapsed-seconds counter displayed above the Board.

## Requirements

### Requirement 1: Pause and Resume

**User Story:** As a player who tracks solve time, I want to pause the game so that I can step away without the timer running or the puzzle being visible.

#### Acceptance Criteria

1. WHEN the playing screen is active, THE App SHALL display a pause button that is always reachable without scrolling.
2. WHEN the player activates the pause button, THE App SHALL stop incrementing the elapsed-seconds timer.
3. WHEN the player activates the pause button, THE App SHALL display a full-screen overlay that obscures the Board and all cell values.
4. WHEN the game is in the Paused state, THE App SHALL display a resume button within the overlay.
5. WHEN the player activates the resume button, THE App SHALL remove the overlay and resume incrementing the elapsed-seconds timer from the previously paused value.
6. WHILE the game is in the Paused state, THE App SHALL prevent all cell-selection, digit-entry, erase, undo, and hint interactions.
7. IF the game transitions to the completed screen while a pause is active, THE App SHALL clear the Paused state and stop the timer.
8. WHEN a new puzzle is loaded or the difficulty changes, THE App SHALL clear the Paused state.

### Requirement 2: Hide / Show Timer

**User Story:** As a player who prefers a relaxed experience, I want to hide the timer so that I can solve the puzzle without time pressure.

#### Acceptance Criteria

1. WHEN the playing screen is active, THE App SHALL display a toggle control that hides or shows the Timer.
2. WHEN the timer-visibility toggle is set to hidden, THE App SHALL replace the Timer display with a placeholder that occupies the same vertical space, preventing layout shift.
3. WHEN the timer-visibility toggle is set to visible, THE App SHALL display the formatted elapsed time in the Timer area.
4. THE App SHALL default to showing the Timer when a new puzzle is loaded.
5. WHEN the game is in the Paused state and the Timer is hidden, THE App SHALL keep the Timer hidden after the player resumes.

### Requirement 3: Collision-Only Error Highlighting

**User Story:** As a player who wants a harder challenge, I want errors to only be highlighted when I place a duplicate digit in the same row, column, or box, so that I am not told outright when a value is wrong.

#### Acceptance Criteria

1. WHEN the playing screen is active, THE App SHALL display a toggle control that switches between error-highlight mode and collision-only mode.
2. THE App SHALL default to error-highlight mode when a new puzzle is loaded.
3. WHEN collision-only mode is active, THE App SHALL mark a cell as a Conflict only when the same digit appears in the same row, column, or box as that cell.
4. WHEN collision-only mode is active, THE App SHALL NOT mark a cell as a Conflict solely because its value does not match the solution.
5. WHEN error-highlight mode is active, THE App SHALL preserve the existing conflict-detection behaviour provided by `updateConflicts` in `sudoku-utils.ts`.
6. WHEN the player toggles between error-highlight mode and collision-only mode, THE App SHALL immediately recompute and re-render conflict highlights across the entire Board.
7. THE Collision_Detector SHALL expose a pure function that accepts a board and returns a new board with conflict flags set according to collision-only rules.
8. FOR ALL boards where no digit appears more than once in any row, column, or box, the Collision_Detector SHALL return a board where every cell has `hasConflict: false`.
