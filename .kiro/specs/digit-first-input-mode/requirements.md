# Requirements Document

## Introduction

The Sudoku app currently uses a "cell-first" input mode: the user taps a cell, then taps a digit to fill it. Many players prefer the opposite workflow — "digit-first" — where they select a digit on the number pad and then tap cells to fill them with that digit. This is especially useful when scanning the board for all placements of a single number. The feature adds a toggle switch so users can choose between cell-first and digit-first input modes.

## Glossary

- **App**: The top-level Svelte component (`App.svelte`) that owns game state and orchestrates input handling.
- **Grid**: The 9×9 Sudoku board component that renders cells and emits pointer events.
- **NumberPad**: The component that renders digit buttons (1–9), erase, undo, hint, and mode controls.
- **Input_Mode**: An enumeration with two values — `cell-first` (current default) and `digit-first`.
- **Locked_Digit**: The digit currently selected for placement in digit-first mode (1–9, or null when no digit is locked).
- **Cell_First_Mode**: The existing input flow where the user selects a cell, then enters a digit.
- **Digit_First_Mode**: The new input flow where the user selects a digit, then taps cells to place that digit.
- **Given_Cell**: A pre-filled cell that cannot be modified by the user.
- **Solved_Digit**: A digit that has been placed 9 times on the board (all instances filled).
- **Notes_Mode**: A toggle that switches digit entry from placing values to toggling pencil-mark candidates.

## Requirements

### Requirement 1: Input Mode Toggle

**User Story:** As a player, I want to switch between cell-first and digit-first input modes, so that I can use whichever workflow suits my play style.

#### Acceptance Criteria

1. THE NumberPad SHALL display a toggle control that switches the Input_Mode between `cell-first` and `digit-first`.
2. WHEN the user activates the Input_Mode toggle, THE App SHALL switch the active Input_Mode to the opposite value.
3. THE App SHALL default the Input_Mode to `cell-first` on game start and on puzzle reset.
4. WHEN the Input_Mode changes from `digit-first` to `cell-first`, THE App SHALL clear the Locked_Digit to null.

### Requirement 2: Digit Locking in Digit-First Mode

**User Story:** As a player using digit-first mode, I want to select a digit on the number pad so that every cell I tap receives that digit.

#### Acceptance Criteria

1. WHILE the Input_Mode is `digit-first`, WHEN the user taps a digit button on the NumberPad, THE App SHALL set the Locked_Digit to that digit.
2. WHILE the Input_Mode is `digit-first`, WHEN the user taps the currently Locked_Digit button on the NumberPad, THE App SHALL clear the Locked_Digit to null.
3. WHILE the Input_Mode is `digit-first`, WHEN the user presses the Escape key, THE App SHALL clear the Locked_Digit to null.
4. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active, WHEN the user taps a different digit button, THE App SHALL change the Locked_Digit to the newly tapped digit.
5. WHILE the Input_Mode is `digit-first` and the Locked_Digit is a Solved_Digit (digit count ≥ 9), THE NumberPad SHALL visually indicate the digit is solved but SHALL still allow the user to lock it.

### Requirement 3: Cell Placement in Digit-First Mode

**User Story:** As a player using digit-first mode with a locked digit, I want to tap cells to immediately place that digit, so that I can quickly fill multiple instances of the same number.

#### Acceptance Criteria

1. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is inactive, WHEN the user taps an empty non-given cell on the Grid, THE App SHALL place the Locked_Digit value into that cell.
2. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is inactive, WHEN the user taps a Given_Cell, THE App SHALL not modify that cell.
3. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is inactive, WHEN a digit is placed into a cell, THE App SHALL clear that cell's pencil-mark notes and clean up peer notes for the placed digit.
4. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is inactive, WHEN a digit is placed into a cell, THE App SHALL update board conflicts.
5. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is inactive, WHEN a digit is placed that completes the board, THE App SHALL trigger completion validation.

### Requirement 4: Notes Mode with Digit-First

**User Story:** As a player using digit-first mode with notes enabled, I want tapping a cell to toggle the locked digit as a pencil mark, so that I can quickly annotate candidates across the board.

#### Acceptance Criteria

1. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is active, WHEN the user taps an empty non-given cell, THE App SHALL toggle the Locked_Digit as a pencil-mark note on that cell.
2. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is active, WHEN the user taps a cell that already has a value, THE App SHALL not modify that cell's notes.
3. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active and Notes_Mode is active, WHEN the user taps a Given_Cell, THE App SHALL not modify that cell.

### Requirement 5: Visual Feedback for Locked Digit

**User Story:** As a player, I want to clearly see which digit is locked on the number pad, so that I know what will be placed when I tap a cell.

#### Acceptance Criteria

1. WHILE a Locked_Digit is active, THE NumberPad SHALL render the Locked_Digit button with a visually distinct selected/active style (differentiated from the default and solved states).
2. WHILE a Locked_Digit is active, THE App SHALL set the highlight digit to the Locked_Digit value so that matching digits on the Grid are highlighted.
3. WHEN the Locked_Digit is cleared to null, THE NumberPad SHALL return all digit buttons to their default visual state.

### Requirement 6: Undo Support

**User Story:** As a player, I want each cell placement made in digit-first mode to be individually undoable, so that I can correct mistakes.

#### Acceptance Criteria

1. WHILE the Input_Mode is `digit-first`, WHEN a digit is placed into a cell, THE App SHALL push a snapshot onto the undo stack before the placement.
2. WHILE the Input_Mode is `digit-first`, WHEN a note is toggled on a cell, THE App SHALL push a snapshot onto the undo stack before the toggle.
3. WHEN the user triggers undo after a digit-first placement, THE App SHALL restore the board and notes to the state before that single placement.

### Requirement 7: Keyboard Input in Digit-First Mode

**User Story:** As a player using a keyboard, I want digit-first mode to work with keyboard input, so that I can use my preferred input method.

#### Acceptance Criteria

1. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active, WHEN the user presses an arrow key, THE App SHALL move the focus cell in the corresponding direction and place the Locked_Digit into the newly focused cell if the cell is empty and non-given (in normal mode) or toggle the note (in Notes_Mode).
2. WHILE the Input_Mode is `digit-first`, WHEN the user presses a digit key (1–9), THE App SHALL update the Locked_Digit to that digit (or clear it if the same digit is already locked).
3. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active, WHEN the user presses Backspace or Delete, THE App SHALL erase the currently focused cell's value (if non-given) without clearing the Locked_Digit.

### Requirement 8: Erase in Digit-First Mode

**User Story:** As a player using digit-first mode, I want the erase button to clear the focused cell without affecting my locked digit, so that I can correct individual cells while continuing to place.

#### Acceptance Criteria

1. WHILE the Input_Mode is `digit-first` and a Locked_Digit is active, WHEN the user taps the erase button on the NumberPad, THE App SHALL erase the value of the currently focused cell (if non-given) and SHALL not clear the Locked_Digit.
2. WHILE the Input_Mode is `digit-first` and no Locked_Digit is active, WHEN the user taps the erase button, THE App SHALL erase the value of the currently focused cell (if non-given).

### Requirement 9: Cell-First Mode Preservation

**User Story:** As a player, I want the existing cell-first input flow to remain unchanged when cell-first mode is active, so that the default experience is not disrupted.

#### Acceptance Criteria

1. WHILE the Input_Mode is `cell-first`, THE App SHALL handle cell taps, digit entry, notes toggling, erase, and undo using the existing cell-first logic without modification.
2. WHILE the Input_Mode is `cell-first`, THE NumberPad SHALL not display any Locked_Digit visual indicator.
