# Requirements Document

## Introduction

Add an undo button to the Sudoku game that allows players to reverse their most recent move. A move is any player-initiated change to the board or notes state: placing a digit, erasing a cell, toggling a note, or applying a hint. The undo stack is maintained in client memory for the duration of a single puzzle session and is cleared when a new puzzle or difficulty is loaded.

## Glossary

- **Undo_Stack**: An ordered list of snapshots capturing board and notes state before each player move, maintained in client memory.
- **Move**: Any player-initiated state change — placing a digit, erasing a cell, toggling a note (including auto-notes), or applying a hint.
- **Board**: The 9×9 grid of `CellState` values representing the current puzzle state.
- **Notes_Board**: The 9×9 grid of `SvelteSet<number>` values representing pencil marks.
- **Snapshot**: An immutable copy of `Board` and `Notes_Board` captured immediately before a Move is applied.
- **Session**: The period from when a puzzle is loaded until a new puzzle or difficulty is selected.
- **App**: The Svelte client application managing game state in `App.svelte`.
- **NumberPad**: The `NumberPad.svelte` component containing digit, erase, notes, and hint controls.

## Requirements

### Requirement 1: Undo Stack Maintenance

**User Story:** As a player, I want every move I make to be recorded, so that I can reverse mistakes at any point during a puzzle.

#### Acceptance Criteria

1. WHEN a player places a digit in a non-given cell, THE App SHALL push a Snapshot of the pre-move Board and Notes_Board onto the Undo_Stack.
2. WHEN a player erases a cell (single or multi-selection), THE App SHALL push a Snapshot of the pre-move Board and Notes_Board onto the Undo_Stack.
3. WHEN a player toggles a note (single cell or auto-notes across a multi-selection), THE App SHALL push a Snapshot of the pre-move Board and Notes_Board onto the Undo_Stack.
4. WHEN a hint is applied, THE App SHALL push a Snapshot of the pre-move Board and Notes_Board onto the Undo_Stack.
5. WHEN a new puzzle is loaded or the difficulty is changed, THE App SHALL clear the Undo_Stack.
6. THE App SHALL limit the Undo_Stack to a maximum of 100 Snapshots, discarding the oldest entry when the limit is exceeded.

### Requirement 2: Undo Action

**User Story:** As a player, I want to press an undo button to reverse my last move, so that I can correct mistakes without restarting the puzzle.

#### Acceptance Criteria

1. WHEN the undo button is activated and the Undo_Stack is non-empty, THE App SHALL pop the most recent Snapshot and restore the Board and Notes_Board to that Snapshot's values.
2. WHEN the undo button is activated and the Undo_Stack is non-empty, THE App SHALL recompute cell conflicts on the restored Board.
3. WHEN the undo button is activated and the Undo_Stack is empty, THE App SHALL take no action.
4. WHILE the game screen is not "playing", THE App SHALL treat the undo button as disabled and ignore activation.
5. WHEN the undo button is activated via keyboard shortcut Ctrl+Z (or Cmd+Z on macOS), THE App SHALL perform the same undo action as pressing the button.

### Requirement 3: Undo Button UI

**User Story:** As a player, I want a clearly visible undo button in the game controls, so that I can discover and use the undo feature without hunting for it.

#### Acceptance Criteria

1. THE NumberPad SHALL render an undo button alongside the existing Notes and Hint controls.
2. WHILE the Undo_Stack is empty or the game screen is not "playing", THE NumberPad SHALL render the undo button in a visually disabled state.
3. WHILE the Undo_Stack is non-empty and the game screen is "playing", THE NumberPad SHALL render the undo button in an enabled state.
4. THE undo button SHALL have an accessible label of "Undo last move".
5. THE undo button SHALL display a recognisable undo icon (↩ or equivalent) consistent with the existing `IconButton` style.

### Requirement 4: Undo Stack Correctness

**User Story:** As a player, I want undo to precisely reverse each move in order, so that repeated undo steps walk back my history one move at a time.

#### Acceptance Criteria

1. WHEN the undo button is activated N consecutive times, THE App SHALL restore the Board and Notes_Board to the state that existed N moves ago.
2. FOR ALL sequences of Moves followed by an equal number of undo activations, THE App SHALL restore the Board and Notes_Board to the state that existed before the first Move in the sequence (round-trip property).
3. WHEN a player makes a new Move after one or more undos, THE App SHALL push a fresh Snapshot without restoring any previously undone states (no redo).
4. IF a hint is undone, THEN THE App SHALL decrement `hintsUsed` by 1 so the hint count reflects the restored state.
