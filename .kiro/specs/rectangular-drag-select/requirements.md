# Requirements Document

## Introduction

Overhaul the cell selection and drag behavior in the Sudoku game to replace the current freeform drag-to-select (which uses `document.elementFromPoint()` and accumulates every cell the pointer passes over) with a rectangular box-select model. A drag from an anchor cell to any other cell selects all cells in the axis-aligned rectangle between them. Shift+click toggle-select is removed. The new pointer tracking uses `setPointerCapture()` and grid-relative coordinate math instead of `elementFromPoint`, making it reliable at any drag speed. Multi-cell selection is exclusively a notes workflow — selecting a region then tapping digits toggles notes on the selected cells.

## Glossary

- **Grid**: The 9×9 Sudoku board rendered by `Grid.svelte`, composed of 81 Cell buttons.
- **Cell**: A single square in the Grid, identified by a (row, col) coordinate pair where both values are integers 0–8.
- **Selection**: The set of Cells currently marked as selected, plus a focus Cell for keyboard navigation.
- **Anchor_Cell**: The Cell where a pointer-down event begins a drag operation.
- **Current_Cell**: The Cell the pointer is currently over during a drag operation.
- **Bounding_Rectangle**: The axis-aligned rectangle defined by the Anchor_Cell and the Current_Cell, containing all Cells whose row is between the two rows (inclusive) and whose column is between the two columns (inclusive).
- **Pointer_Capture**: The browser API (`setPointerCapture`) that routes all subsequent pointer events to the capturing element, regardless of pointer position.
- **Grid_Bounding_Rect**: The DOM bounding rectangle of the Grid element, used to compute Cell coordinates from pointer positions via division by cell size.
- **Notes_Mode**: The input mode where digit taps toggle candidate notes on selected Cells rather than placing answer digits.
- **Digit_First_Mode**: The input mode where a digit is locked first and then cells are tapped to place that digit.

## Requirements

### Requirement 1: Single-Tap Cell Selection

**User Story:** As a player, I want to tap a single cell to select it and clear any previous selection, so that I can focus on one cell at a time.

#### Acceptance Criteria

1. WHEN a pointer-down event occurs on a Cell without a subsequent drag, THE Selection SHALL contain exactly that one Cell.
2. WHEN a single-tap selects a Cell, THE Selection SHALL clear all previously selected Cells.
3. WHEN a single-tap selects a Cell, THE Selection SHALL set the focus Cell to the tapped Cell.
4. WHEN a single-tap occurs on a Cell that has a non-zero value, THE Grid SHALL set the highlight digit to that Cell's value.

### Requirement 2: Rectangular Drag Selection

**User Story:** As a player, I want to press on a cell and drag to another cell to select all cells in the rectangle between them, so that I can quickly select a region for batch note entry.

#### Acceptance Criteria

1. WHEN a pointer-down event occurs on a Cell, THE Grid SHALL record that Cell as the Anchor_Cell.
2. WHEN the pointer moves to a different Cell during a drag, THE Selection SHALL contain exactly the Cells within the Bounding_Rectangle defined by the Anchor_Cell and the Current_Cell.
3. WHILE a drag is in progress, THE Selection SHALL update the Bounding_Rectangle on every pointer-move that changes the Current_Cell.
4. WHEN the pointer is released after a drag, THE Selection SHALL retain the final Bounding_Rectangle as the active selection.
5. THE Bounding_Rectangle SHALL include all Cells whose row index is between min(Anchor_Cell.row, Current_Cell.row) and max(Anchor_Cell.row, Current_Cell.row) inclusive, and whose column index is between min(Anchor_Cell.col, Current_Cell.col) and max(Anchor_Cell.col, Current_Cell.col) inclusive.
6. WHEN the Anchor_Cell and Current_Cell are the same Cell, THE Bounding_Rectangle SHALL contain exactly one Cell.

### Requirement 3: Pointer Capture for Reliable Tracking

**User Story:** As a player, I want drag selection to work reliably even when dragging fast, so that I don't get broken selections from missed cells.

#### Acceptance Criteria

1. WHEN a pointer-down event begins a drag on the Grid, THE Grid SHALL call `setPointerCapture()` on the Grid element for that pointer.
2. WHILE Pointer_Capture is active, THE Grid SHALL compute the Current_Cell from the pointer's client coordinates using the Grid_Bounding_Rect divided into a 9×9 grid of equal cells.
3. WHEN the pointer is released, THE Grid SHALL release Pointer_Capture.
4. IF the pointer coordinates fall outside the Grid_Bounding_Rect during a drag, THEN THE Grid SHALL clamp the computed Cell coordinates to the valid range of 0–8 for both row and column.

### Requirement 4: Remove Shift+Click Toggle Selection

**User Story:** As a player, I want a simpler selection model without hidden modifier-key interactions, so that selection behavior is predictable and discoverable.

#### Acceptance Criteria

1. THE Grid SHALL NOT invoke toggle-selection behavior on shift+pointer-down events.
2. WHEN a shift+pointer-down event occurs on a Cell, THE Grid SHALL treat the event as a regular single-tap selection (same as Requirement 1).

### Requirement 5: Selection Persistence Across Number Taps

**User Story:** As a player, I want my rectangular selection to stay active after tapping a number, so that I can toggle multiple notes on the same region without re-selecting.

#### Acceptance Criteria

1. WHEN a digit is tapped while a multi-cell Selection is active, THE Selection SHALL remain unchanged after the note toggle completes.
2. WHEN the Erase action is invoked while a multi-cell Selection is active, THE Selection SHALL remain unchanged after the erase completes.
3. WHEN a single-tap occurs on a Cell (pointer-down without drag), THE Selection SHALL clear the previous multi-cell selection and select only the tapped Cell.
4. WHEN the Escape key is pressed, THE Selection SHALL clear to an empty selection.

### Requirement 6: Grid-Relative Cell Coordinate Computation

**User Story:** As a developer, I want cell position to be computed from pointer coordinates using grid math rather than DOM queries, so that the implementation is fast and doesn't break at high drag speeds.

#### Acceptance Criteria

1. THE Grid SHALL compute Cell row as `Math.floor((pointerY - gridTop) / (gridHeight / 9))` clamped to the range 0–8.
2. THE Grid SHALL compute Cell column as `Math.floor((pointerX - gridLeft) / (gridWidth / 9))` clamped to the range 0–8.
3. THE Grid SHALL NOT use `document.elementFromPoint()` for determining which Cell the pointer is over.
4. THE Grid SHALL NOT use `data-row` or `data-col` DOM attributes for pointer-move cell resolution during drag.

### Requirement 7: Rectangular Selection Utility Functions

**User Story:** As a developer, I want pure utility functions for computing rectangular selections, so that the selection logic is testable independently of the DOM.

#### Acceptance Criteria

1. THE Selection_Utils module SHALL export a `computeRectSelection` function that accepts an Anchor_Cell coordinate and a Current_Cell coordinate and returns a Selection containing exactly the Cells in the Bounding_Rectangle.
2. WHEN `computeRectSelection` is called with identical anchor and current coordinates, THE function SHALL return a Selection containing exactly one Cell.
3. FOR ALL valid Anchor_Cell and Current_Cell coordinate pairs, `computeRectSelection(anchor, current)` SHALL produce a Selection whose cell count equals `(|anchor.row - current.row| + 1) × (|anchor.col - current.col| + 1)`.
4. FOR ALL valid coordinate pairs, `computeRectSelection(a, b)` SHALL produce the same Selection as `computeRectSelection(b, a)` (commutativity).
5. THE Selection_Utils module SHALL export a `cellFromPointer` function that accepts pointer coordinates (x, y) and a grid bounding rectangle and returns a (row, col) coordinate clamped to 0–8.
6. FOR ALL pointer coordinates within the Grid_Bounding_Rect, `cellFromPointer` SHALL return the correct (row, col) based on dividing the grid into 9 equal rows and 9 equal columns.

### Requirement 8: Remove Legacy Selection Functions

**User Story:** As a developer, I want to remove the unused freeform selection functions, so that the codebase stays clean and there is no confusion about which selection model is active.

#### Acceptance Criteria

1. THE Selection_Utils module SHALL NOT export the `extendSelection` function.
2. THE Selection_Utils module SHALL NOT export the `toggleSelection` function.
3. WHEN `extendSelection` or `toggleSelection` are removed, THE App module SHALL remove all references to those functions including imports, handler functions, and Grid component props.
4. THE Grid component SHALL NOT accept `onCellExtend` or `onCellToggle` callback props.
