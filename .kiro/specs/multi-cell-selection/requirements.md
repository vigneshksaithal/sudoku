# Requirements Document

## Introduction

Multi-cell selection allows players to select multiple cells on the Sudoku grid and enter notes (pencil marks) into all selected cells at once. When a single cell is selected, digit input behaves normally (places a value). When multiple cells are selected, digit input automatically enters notes into all selected empty cells — no need to toggle notes mode manually. This mirrors the UX pattern used by sudokuexchange.com and other popular Sudoku apps.

## Glossary

- **Grid**: The 9×9 Sudoku board rendered as a grid of interactive cell buttons
- **Cell**: A single square in the Grid, identified by its row and column (0–8)
- **Selection**: The set of currently selected Cells in the Grid
- **Single_Selection**: A Selection containing exactly one Cell
- **Multi_Selection**: A Selection containing two or more Cells
- **Focus_Cell**: The most recently selected Cell in the Selection, used for keyboard navigation and digit highlighting
- **Pointer**: A mouse cursor or touch contact point used to interact with the Grid
- **Drag_Selection**: The act of pressing a Pointer on one Cell and moving it across other Cells to add them to the Selection
- **Notes_Mode**: The existing toggle that switches digit input between value placement and note entry
- **Auto_Notes**: The behavior where digit input automatically enters notes when a Multi_Selection is active, regardless of Notes_Mode state
- **NumberPad**: The on-screen digit input component with buttons 1–9, erase, and notes toggle
- **Empty_Cell**: A Cell whose value is 0 and whose isGiven flag is false
- **Given_Cell**: A Cell whose isGiven flag is true (pre-filled puzzle clue)

## Requirements

### Requirement 1: Single Cell Selection

**User Story:** As a player, I want to tap or click a single cell to select it exclusively, so that I can place a digit or note in that cell.

#### Acceptance Criteria

1. WHEN a player presses a Pointer on a Cell without holding a modifier key, THE Grid SHALL clear the current Selection and set the Selection to contain only that Cell
2. WHEN a Cell is selected via single press, THE Grid SHALL set the Focus_Cell to that Cell
3. WHEN a Cell is selected, THE Grid SHALL display a visual ring indicator on the selected Cell

### Requirement 2: Drag Selection

**User Story:** As a player, I want to press on a cell and drag across other cells to select multiple cells, so that I can quickly select a group of cells for batch note entry.

#### Acceptance Criteria

1. WHEN a player presses a Pointer on a Cell and moves the Pointer over other Cells without releasing, THE Grid SHALL add each entered Cell to the Selection
2. WHEN a Drag_Selection is in progress, THE Grid SHALL set the Focus_Cell to the most recently entered Cell
3. WHEN a player releases the Pointer after a Drag_Selection, THE Grid SHALL keep all dragged-over Cells in the Selection
4. WHILE a Drag_Selection is in progress, THE Grid SHALL display a visual selection indicator on every Cell in the Selection

### Requirement 3: Modifier-Key Multi Selection

**User Story:** As a player, I want to hold Ctrl (or Cmd on Mac) and click cells to toggle them in and out of my selection, so that I can select non-contiguous cells.

#### Acceptance Criteria

1. WHEN a player presses a Pointer on a Cell while holding the Ctrl or Meta modifier key, THE Grid SHALL toggle that Cell in or out of the Selection without clearing existing selected Cells
2. WHEN a Cell is toggled into the Selection via modifier-click, THE Grid SHALL set the Focus_Cell to that Cell
3. WHEN a Cell is toggled out of the Selection via modifier-click and other Cells remain selected, THE Grid SHALL set the Focus_Cell to the previously focused Cell

### Requirement 4: Touch Drag Selection

**User Story:** As a player on a touch device, I want to touch a cell and drag my finger across cells to select multiple cells, so that I can use multi-cell selection without a mouse.

#### Acceptance Criteria

1. WHEN a player touches a Cell and moves the touch contact across other Cells, THE Grid SHALL add each Cell under the touch contact to the Selection
2. WHEN a touch Drag_Selection is in progress, THE Grid SHALL identify the Cell under the touch contact using the touch coordinates and the document element lookup
3. WHEN a player lifts the touch contact after a touch Drag_Selection, THE Grid SHALL keep all touched Cells in the Selection

### Requirement 5: Auto Notes on Multi Selection

**User Story:** As a player, I want digit input to automatically enter notes when I have multiple cells selected, so that I don't have to manually toggle notes mode for batch note entry.

#### Acceptance Criteria

1. WHEN a player inputs a digit while a Multi_Selection is active, THE Grid SHALL toggle the note for that digit on every Empty_Cell in the Selection
2. WHEN a player inputs a digit while a Multi_Selection is active, THE Grid SHALL skip Given_Cells and Cells that already have a placed value
3. WHEN a player inputs a digit while a Single_Selection is active and Notes_Mode is off, THE Grid SHALL place the digit as a value in the selected Cell (existing behavior)
4. WHEN a player inputs a digit while a Single_Selection is active and Notes_Mode is on, THE Grid SHALL toggle the note for that digit on the selected Cell (existing behavior)

### Requirement 6: Erase on Multi Selection

**User Story:** As a player, I want the erase action to clear notes from all selected cells when multiple cells are selected, so that I can quickly clean up notes in bulk.

#### Acceptance Criteria

1. WHEN a player triggers erase while a Multi_Selection is active, THE Grid SHALL clear all notes from every Empty_Cell in the Selection
2. WHEN a player triggers erase while a Multi_Selection is active, THE Grid SHALL skip Given_Cells
3. WHEN a player triggers erase while a Single_Selection is active, THE Grid SHALL erase the selected Cell's value or notes according to existing behavior

### Requirement 7: Keyboard Navigation with Selection

**User Story:** As a player, I want arrow keys to move the Focus_Cell and reset to single selection, so that keyboard navigation remains intuitive after a multi-select action.

#### Acceptance Criteria

1. WHEN a player presses an arrow key, THE Grid SHALL move the Focus_Cell one step in the arrow direction and set the Selection to contain only the new Focus_Cell
2. WHEN a player presses an arrow key at the edge of the Grid, THE Grid SHALL clamp the Focus_Cell to the Grid boundary

### Requirement 8: Selection Visual Feedback

**User Story:** As a player, I want to clearly see which cells are selected, so that I know which cells will be affected by my next input.

#### Acceptance Criteria

1. WHILE a Multi_Selection is active, THE Grid SHALL display a distinct background highlight on every Cell in the Selection
2. WHILE a Multi_Selection is active, THE Grid SHALL display the Focus_Cell with an additional ring indicator to distinguish the Focus_Cell from other selected Cells
3. THE Grid SHALL ensure the selection highlight is visually distinct from the conflict highlight, the digit highlight, and the notes highlight

### Requirement 9: Clear Selection

**User Story:** As a player, I want to press Escape to clear my selection, so that I can deselect all cells without clicking elsewhere.

#### Acceptance Criteria

1. WHEN a player presses the Escape key, THE Grid SHALL clear the Selection and set the Focus_Cell to null
