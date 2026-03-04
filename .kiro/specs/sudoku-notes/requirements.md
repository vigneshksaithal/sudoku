# Requirements Document

## Introduction

Pencil marks (notes) support for the Sudoku puzzle app, allowing players to annotate empty cells with candidate digits 1–9. Notes are displayed as a 3×3 mini-grid inside each cell, toggled via a dedicated notes mode button or Shift+number keyboard shortcut. When a digit is placed as a value, auto-cleanup removes that digit from notes in all peer cells (same row, column, and 3×3 box). Highlighting is extended so selecting a digit shows value matches and note matches across the board. Notes are client-only — no server persistence or API changes required.

## Glossary

- **Notes_Board**: A 9×9 array of `SvelteSet<number>` instances storing candidate digits for each cell
- **Note**: A candidate digit (1–9) annotated on an empty cell, displayed as part of a 3×3 mini-grid
- **Notes_Mode**: A boolean toggle state that routes number input to note toggling instead of value placement
- **Peer**: A cell that shares the same row, column, or 3×3 box as a given cell (exactly 20 peers per cell, excluding self)
- **Auto_Cleanup**: The process of removing a placed digit from the notes of all peer cells
- **Highlight_Digit**: The currently selected digit used to visually emphasize matching values and notes across the board
- **Notes_Utils**: The utility module (`notes-utils.ts`) containing pure functions for notes manipulation
- **Grid**: The 9×9 Svelte component that renders the Sudoku board, cell values, notes mini-grids, and highlighting
- **NumberPad**: The input component providing buttons 1–9, an erase action, and a notes mode toggle
- **Client**: The Svelte 5 webview application running inside the Devvit post sandbox
- **Cell_Coord**: A readonly tuple `[row, col]` identifying a cell position on the board

## Requirements

### Requirement 1: Notes Board Initialization

**User Story:** As a player, I want a clean notes board when I start a puzzle, so that I begin without stale annotations.

#### Acceptance Criteria

1. WHEN a new puzzle is loaded, THE Client SHALL create a Notes_Board with 81 empty sets (one per cell)
2. THE Notes_Utils SHALL ensure each set in the Notes_Board is an independent instance, so that mutating one cell's notes does not affect any other cell's notes
3. WHEN the player starts a new puzzle, THE Client SHALL reset the Notes_Board to an empty state and set Notes_Mode to false

### Requirement 2: Notes Mode Toggle

**User Story:** As a player, I want to switch between value entry and notes entry, so that I can annotate cells with candidate digits.

#### Acceptance Criteria

1. THE NumberPad SHALL display a notes toggle button with a pencil icon (✏️)
2. WHEN the player taps the notes toggle button, THE Client SHALL flip the Notes_Mode state between true and false
3. WHILE Notes_Mode is true, THE NumberPad SHALL display the notes toggle button with an active visual state distinct from the inactive state
4. WHILE Notes_Mode is true AND the player taps a digit on the NumberPad, THE Client SHALL toggle that digit in the selected cell's notes instead of placing a value

### Requirement 3: Toggle Note on a Cell

**User Story:** As a player, I want to add or remove candidate digits from a cell's notes, so that I can track possible values while solving.

#### Acceptance Criteria

1. WHEN the player toggles a digit on an empty non-Given cell, THE Notes_Utils SHALL add the digit to the cell's note set if absent, or remove the digit if present
2. WHEN the player toggles a note, THE Notes_Utils SHALL modify only the targeted cell's note set and leave all other cells' notes unchanged
3. WHEN the player attempts to toggle a note on a Given cell, THE Client SHALL ignore the action
4. WHEN the player attempts to toggle a note on a cell with a non-zero value, THE Client SHALL ignore the action
5. THE Notes_Utils SHALL accept only digits 1 through 9 as valid note values

### Requirement 4: Keyboard Shortcut for Notes

**User Story:** As a player using a keyboard, I want to toggle notes with Shift+number, so that I can annotate cells without switching modes.

#### Acceptance Criteria

1. WHEN the player presses Shift combined with a digit key (1–9) while a cell is selected, THE Client SHALL toggle that digit in the selected cell's notes regardless of the current Notes_Mode
2. WHEN the player presses Shift combined with a digit key while no cell is selected, THE Client SHALL ignore the action

### Requirement 5: Auto-Cleanup of Notes on Value Placement

**User Story:** As a player, I want notes to be automatically cleaned up when I place a digit, so that impossible candidates are removed without manual effort.

#### Acceptance Criteria

1. WHEN a digit is placed as a value in a cell, THE Client SHALL clear all notes from that cell
2. WHEN a digit is placed as a value in a cell, THE Notes_Utils SHALL remove that digit from the note sets of all Peer cells
3. WHEN Auto_Cleanup removes a digit from Peer notes, THE Notes_Utils SHALL not modify the notes of any non-Peer cell
4. WHEN a value is erased from a cell, THE Client SHALL not restore any previously removed notes

### Requirement 6: Peer Calculation

**User Story:** As a developer, I want a correct peer calculation utility, so that auto-cleanup and constraint logic operate on the right cells.

#### Acceptance Criteria

1. THE Notes_Utils SHALL compute exactly 20 unique Peer coordinates for any valid cell position
2. THE Notes_Utils SHALL exclude the cell itself from its own Peer list
3. THE Notes_Utils SHALL include all cells sharing the same row, same column, or same 3×3 box as the given cell in the Peer list
4. THE Notes_Utils SHALL return no duplicate coordinates in the Peer list

### Requirement 7: Notes Display in Grid

**User Story:** As a player, I want to see my notes displayed clearly inside cells, so that I can read candidate digits at a glance.

#### Acceptance Criteria

1. WHILE a cell has a non-zero value, THE Grid SHALL display the value and not render any notes for that cell
2. WHILE a cell has value zero and contains notes, THE Grid SHALL render the notes as a 3×3 mini-grid inside the cell
3. THE Grid SHALL position each note digit 1–9 in its corresponding mini-grid slot (1 in top-left through 9 in bottom-right)
4. THE Grid SHALL scale note font size responsively using smaller text at base size and slightly larger text on wider viewports

### Requirement 8: Highlight Matching for Notes

**User Story:** As a player, I want matching values and notes highlighted when I select a digit, so that I can see where candidates appear across the board.

#### Acceptance Criteria

1. WHEN a cell with a non-zero value is selected, THE Client SHALL set the Highlight_Digit to that cell's value
2. WHEN no cell is selected or the selected cell has value zero, THE Client SHALL set the Highlight_Digit to null
3. WHILE a Highlight_Digit is active, THE Grid SHALL apply a blue background to cells whose value matches the Highlight_Digit
4. WHILE a Highlight_Digit is active, THE Grid SHALL apply a yellow background to cells whose notes contain the Highlight_Digit
5. WHILE a Highlight_Digit is active, THE Grid SHALL render the matching note digit in bold blue text within the 3×3 mini-grid
6. THE Grid SHALL apply highlight styles that adapt to light and dark mode via Tailwind CSS

### Requirement 9: Erase Behavior in Notes Mode

**User Story:** As a player, I want the erase button to clear notes when in notes mode, so that I can quickly remove all candidates from a cell.

#### Acceptance Criteria

1. WHILE Notes_Mode is true AND the player taps the erase action, THE Client SHALL clear all notes from the selected cell without modifying the cell's value
2. WHILE Notes_Mode is false AND the player taps the erase action, THE Client SHALL clear the cell's value as per existing behavior

### Requirement 10: Test-Driven Development for Notes

**User Story:** As a developer, I want all notes utility functions covered by automated tests written before implementation, so that correctness is verified continuously.

#### Acceptance Criteria

1. WHEN implementing any notes utility function, THE Developer SHALL write a failing test in `src/client/lib/__tests__/notes-utils.test.ts` before writing the implementation code
2. THE Client SHALL use `fast-check` for property-based tests that verify the correctness properties defined in the design document
3. THE Client SHALL pass all tests via `bun run test` with zero failures before each implementation checkpoint
