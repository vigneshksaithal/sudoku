# Requirements Document

## Introduction

Add Shift+Click as a toggle-based multi-cell selection mechanism to the Sudoku game. Currently, single-tap selects one cell and drag selects a rectangle. This feature introduces Shift+Click to toggle individual cells in and out of the current selection, enabling non-contiguous multi-cell selections. The previous `rectangular-drag-select` spec explicitly removed Shift+Click toggle behavior; this spec re-introduces it as a deliberate toggle model (add or remove) that coexists with rectangular drag-select. This feature is desktop-only; no touch or mobile equivalent is provided. Arrow key selection extension (Shift+Arrow) is explicitly out of scope — arrow keys continue to move focus and reset to single-cell selection as they do today.

## Glossary

- **Grid**: The 9×9 Sudoku board rendered by `Grid.svelte`, composed of 81 Cell buttons.
- **Cell**: A single square in the Grid, identified by a (row, col) coordinate pair where both values are integers 0–8.
- **Selection**: The set of Cells currently marked as selected, plus a focus Cell for keyboard navigation. Defined as `{ cells: ReadonlySet<string>, focusCell: CellCoord | null }`.
- **Focus_Cell**: The Cell within the Selection that receives keyboard input and visual focus indication.
- **Shift_Click**: A pointer-down event on a Cell while the Shift modifier key is held.
- **Selection_Utils**: The `selection-utils.ts` module containing pure functions for selection manipulation.
- **Notes_Mode**: The input mode where digit taps toggle candidate notes on selected Cells rather than placing answer digits.
- **Digit_First_Mode**: The input mode where a digit is locked first and then cells are tapped to place that digit.
- **Locked_Digit**: The digit currently selected in Digit_First_Mode, applied to cells on tap or lock action.
- **Given_Cell**: A Cell whose value was part of the original puzzle and cannot be modified by the player.

## Requirements

### Requirement 1: Shift+Click Toggles a Cell In or Out of the Selection

**User Story:** As a player, I want to Shift+Click a cell to add it to my selection if unselected, or remove it if already selected, so that I can build and refine non-contiguous multi-cell selections.

#### Acceptance Criteria

1. WHEN a Shift_Click occurs on a Cell that is not in the current Selection, THE Selection SHALL add that Cell to the existing Selection without removing any previously selected Cells.
2. WHEN a Shift_Click occurs on a Cell that is already in the current Selection and the Selection contains more than one Cell, THE Selection SHALL remove that Cell from the Selection.
3. WHEN a Shift_Click occurs on the only Cell in the Selection, THE Selection SHALL retain that Cell in the Selection (the Selection SHALL NOT become empty via Shift+Click).
4. WHEN a Shift_Click occurs on a Cell while the Selection is empty, THE Selection SHALL contain exactly that one Cell.
5. WHEN a Shift_Click occurs on a Cell, THE Selection SHALL set the Focus_Cell to the Shift+Clicked Cell.
6. WHEN a Shift_Click removes a Cell that was the Focus_Cell and the Selection still contains other Cells, THE Selection SHALL set the Focus_Cell to an arbitrary remaining Cell in the Selection.

### Requirement 2: Shift+Click Does Not Initiate a Drag

**User Story:** As a player, I want Shift+Click to only toggle individual cells without triggering drag-select behavior, so that the two selection modes do not interfere with each other.

#### Acceptance Criteria

1. WHEN a Shift+pointer-down event occurs on a Cell, THE Grid SHALL NOT initiate a drag operation.
2. WHEN a Shift+pointer-down event occurs on a Cell, THE Grid SHALL NOT call `setPointerCapture()`.
3. WHEN a Shift+pointer-down event occurs on a Cell, THE Grid SHALL NOT record an Anchor_Cell for rectangular drag selection.

### Requirement 3: Shift+Click Composes with Drag Selection

**User Story:** As a player, I want to drag-select a rectangle and then Shift+Click additional cells to add or remove them, so that I can build complex selections combining both methods.

#### Acceptance Criteria

1. WHEN a rectangular drag selection is active and a subsequent Shift_Click occurs on a Cell outside the rectangle, THE Selection SHALL contain all Cells from the rectangle plus the Shift+Clicked Cell.
2. WHEN a rectangular drag selection is active and a subsequent Shift_Click occurs on a Cell inside the rectangle, THE Selection SHALL remove that Cell from the Selection (provided the Selection contains more than one Cell).

### Requirement 4: Toggle Cell Selection Utility Function

**User Story:** As a developer, I want a pure utility function for toggle cell selection, so that the selection logic is testable independently of the DOM.

#### Acceptance Criteria

1. THE Selection_Utils module SHALL export a `toggleCellSelection` function that accepts a current Selection and a Cell coordinate and returns a new Selection.
2. WHEN `toggleCellSelection` is called with a Cell not in the current Selection, THE function SHALL return a Selection containing all previous Cells plus the new Cell, with Focus_Cell set to the new Cell.
3. WHEN `toggleCellSelection` is called with a Cell already in the current Selection and the Selection contains more than one Cell, THE function SHALL return a Selection with that Cell removed.
4. WHEN `toggleCellSelection` is called with a Cell that is the only Cell in the Selection, THE function SHALL return the same Selection unchanged (single-cell minimum).
5. WHEN `toggleCellSelection` is called with an empty Selection, THE function SHALL return a Selection containing exactly the given Cell with Focus_Cell set to that Cell.
6. FOR ALL valid Cell coordinates and all valid Selections, `toggleCellSelection` SHALL return a Selection where the Focus_Cell is contained in the cells set.

### Requirement 5: Non-Shift Click Resets to Single-Cell Selection

**User Story:** As a player, I want a regular click (without Shift) to clear any multi-cell selection and select only the clicked cell, so that I can easily reset my selection.

#### Acceptance Criteria

1. WHEN a pointer-down event occurs on a Cell without the Shift modifier, THE Selection SHALL clear all previously selected Cells and select only the clicked Cell (existing single-tap behavior preserved).
2. WHEN a drag operation begins without the Shift modifier, THE Selection SHALL replace any previous selection with the rectangular drag selection (existing drag behavior preserved).

### Requirement 6: Digit-First Mode Batch Placement on Multi-Selection

**User Story:** As a player, I want to lock a digit in digit-first mode and have it placed into all my shift-selected cells at once, so that I can efficiently fill multiple cells with the same value.

#### Acceptance Criteria

1. WHEN the player locks a Locked_Digit in Digit_First_Mode while a multi-cell Selection is active and Notes_Mode is not active, THE App SHALL place the Locked_Digit into every selected Cell that is not a Given_Cell.
2. WHEN batch-placing a Locked_Digit, THE App SHALL overwrite the value of non-Given_Cell selected Cells that already contain a different digit.
3. WHEN batch-placing a Locked_Digit, THE App SHALL skip Given_Cells without modifying them or producing an error.
4. WHEN batch-placing a Locked_Digit, THE App SHALL clear notes and clean up peer notes for each Cell that receives the digit.
5. WHEN batch-placing a Locked_Digit, THE App SHALL push a single undo snapshot before the batch operation begins.
6. WHEN batch-placing a Locked_Digit, THE App SHALL check for puzzle completion after all placements are applied.

### Requirement 7: Desktop-Only Constraint

**User Story:** As a developer, I want the Shift+Click selection feature to target desktop pointer devices only, so that the implementation does not need to account for touch or mobile interactions.

#### Acceptance Criteria

1. THE Grid SHALL rely on the `shiftKey` property of pointer events to detect Shift+Click, which is only available on desktop devices with a physical keyboard.
2. THE Grid SHALL NOT provide a touch-based or mobile equivalent for Shift+Click toggle selection.

### Requirement 8: Arrow Keys Do Not Extend Shift+Click Selection

**User Story:** As a player, I want arrow keys to continue moving focus and resetting to a single cell as they do today, so that keyboard navigation remains simple and predictable.

#### Acceptance Criteria

1. WHEN an arrow key is pressed while a multi-cell Selection is active, THE Selection SHALL reset to a single-cell Selection at the new focus position (existing arrow key behavior preserved).
2. THE Grid SHALL NOT implement Shift+Arrow key selection extension for this feature.
