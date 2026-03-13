# Requirements Document

## Introduction

This feature replaces the existing hint system — which auto-fills the correct value into a cell — with a technique-based hint system that teaches Sudoku solving techniques. When a player requests a hint, the system identifies the easiest applicable technique on the current board, explains it in a hint panel with highlighted cells, and lets the player optionally apply it. Techniques range from Naked Singles and Hidden Singles (easy) through Naked/Hidden Pairs (medium) to Pointing Pairs and Box/Line Reductions (hard). A client-side technique detection engine implemented as pure functions scans a computed candidate board and returns structured hints. The existing hint count cap (MAX_HINTS = 3) and undo integration are preserved.

## Glossary

- **Technique_Engine**: The pipeline of pure detector functions in `technique-engine.ts` that tries techniques in priority order and returns the first match.
- **CandidateBoard**: A 9×9 grid of `ReadonlySet<number>` computed from the current board state, where each empty cell's set contains digits 1–9 not present in any peer.
- **TechniqueHint**: A structured object describing a detected technique: its type, difficulty, title, description, affected cells, action type, digit, and optional eliminations.
- **TechniqueType**: One of `'naked-single'`, `'hidden-single'`, `'naked-pair'`, `'hidden-pair'`, `'pointing-pair'`, `'box-line-reduction'`.
- **TechniqueAction**: Either `'placement'` (place a digit in a cell) or `'elimination'` (remove candidates from notes).
- **TechniqueHighlight**: An object with `primaryCells` and `secondaryCells` arrays used by the Grid for multi-cell highlighting.
- **HintPanel**: The `HintPanel.svelte` component that displays the active technique hint with explanation and Apply/Dismiss buttons.
- **activeHint**: The currently displayed `TechniqueHint | null` state in App.svelte.
- **Naked Single**: A cell with exactly one remaining candidate digit.
- **Hidden Single**: A digit that can only go in one cell within a row, column, or box.
- **Naked Pair**: Two cells in a unit sharing exactly the same two candidates.
- **Hidden Pair**: Two digits that can only go in the same two cells within a unit.
- **Pointing Pair**: Candidates for a digit in a box that are all aligned on one row or column.
- **Box/Line Reduction**: Candidates for a digit in a row/column that are all within one box.
- **Unit**: A row, column, or 3×3 box — any group of 9 cells that must contain digits 1–9 exactly once.
- **Peer**: Any cell sharing a row, column, or box with a given cell.
- **Primary Cells**: The cell(s) where the technique's action is applied (highlighted in green/teal).
- **Secondary Cells**: Related cells that explain the technique's logic (highlighted in light blue/cyan).

## Requirements

### Requirement 1: Candidate Board Computation

**User Story:** As a developer, I want a pure function that computes valid candidates for every cell on the board, so that all technique detectors share a consistent, correct foundation.

#### Acceptance Criteria

1. WHEN `buildCandidateBoard` is called with a board, THE function SHALL return a 9×9 grid of `ReadonlySet<number>`.
2. FOR every filled cell (value !== 0), THE returned set SHALL be empty.
3. FOR every empty cell, THE returned set SHALL contain exactly the digits 1–9 that do not appear as values in any peer (same row, column, or box).
4. THE function SHALL produce no mutations to the input board.

---

### Requirement 2: Naked Single Detection

**User Story:** As a player, I want the hint system to detect when a cell has only one possible digit, so that I learn the most basic solving technique.

#### Acceptance Criteria

1. WHEN `detectNakedSingle` is called and a cell exists with exactly one candidate, THE function SHALL return a `TechniqueHint` with `action === 'placement'` and `primaryCells` containing that cell.
2. WHEN `detectNakedSingle` returns a non-null hint, THE `hint.digit` SHALL equal the sole element of the candidate set for that cell.
3. WHEN `detectNakedSingle` returns a non-null hint, THE `hint.digit` SHALL equal `solution[row * 9 + col]`.
4. WHEN no cell has exactly one candidate, THE function SHALL return `null`.
5. IF multiple cells have exactly one candidate, THE function SHALL return the one with the lowest cell index (`row * 9 + col`).

---

### Requirement 3: Hidden Single Detection

**User Story:** As a player, I want the hint system to detect when a digit can only go in one cell within a unit, so that I learn to scan rows, columns, and boxes for unique placements.

#### Acceptance Criteria

1. WHEN `detectHiddenSingle` is called and a digit appears as a candidate in exactly one cell within a unit, THE function SHALL return a `TechniqueHint` with `action === 'placement'` and `primaryCells` containing that cell.
2. WHEN `detectHiddenSingle` returns a non-null hint, THE `hint.digit` SHALL equal `solution[row * 9 + col]`.
3. WHEN no digit is restricted to a single cell in any unit, THE function SHALL return `null`.
4. THE function SHALL check units in deterministic order: rows (0–8), then columns (0–8), then boxes (0–8).

---

### Requirement 4: Naked Pair Detection

**User Story:** As a player, I want the hint system to detect naked pairs, so that I learn to eliminate candidates based on paired cells.

#### Acceptance Criteria

1. WHEN `detectNakedPair` is called and two cells in a unit share exactly the same 2-candidate set, AND other cells in that unit contain either of those candidates, THE function SHALL return a `TechniqueHint` with `action === 'elimination'`.
2. WHEN a naked pair is found, THE `hint.primaryCells` SHALL contain exactly the two paired cells.
3. WHEN a naked pair is found, THE `hint.eliminations` SHALL list cells in the unit (excluding the pair) that contain either paired digit, specifying which digits to remove.
4. WHEN no naked pair with useful eliminations exists, THE function SHALL return `null`.

---

### Requirement 5: Hidden Pair Detection

**User Story:** As a player, I want the hint system to detect hidden pairs, so that I learn to identify digits restricted to the same two cells.

#### Acceptance Criteria

1. WHEN `detectHiddenPair` is called and two digits appear as candidates in exactly the same two cells within a unit, AND those cells have additional candidates beyond the pair digits, THE function SHALL return a `TechniqueHint` with `action === 'elimination'`.
2. WHEN a hidden pair is found, THE `hint.primaryCells` SHALL contain exactly the two cells.
3. WHEN a hidden pair is found, THE `hint.eliminations` SHALL remove all candidates except the pair digits from those two cells.
4. WHEN no hidden pair with useful eliminations exists, THE function SHALL return `null`.

---

### Requirement 6: Pointing Pair Detection

**User Story:** As a player, I want the hint system to detect pointing pairs, so that I learn how box constraints can eliminate candidates along a line.

#### Acceptance Criteria

1. WHEN `detectPointingPair` is called and all candidate cells for a digit within a box lie in a single row or column, AND that digit appears as a candidate in other cells of that row/column outside the box, THE function SHALL return a `TechniqueHint` with `action === 'elimination'`.
2. WHEN a pointing pair is found, THE `hint.primaryCells` SHALL contain the aligned cells within the box.
3. WHEN a pointing pair is found, THE `hint.eliminations` SHALL remove the digit from cells in the aligned row/column that are outside the box.
4. WHEN no pointing pair with useful eliminations exists, THE function SHALL return `null`.

---

### Requirement 7: Box/Line Reduction Detection

**User Story:** As a player, I want the hint system to detect box/line reductions, so that I learn how line constraints can eliminate candidates within a box.

#### Acceptance Criteria

1. WHEN `detectBoxLineReduction` is called and all candidate cells for a digit within a row or column lie in a single box, AND that digit appears as a candidate in other cells of that box outside the row/column, THE function SHALL return a `TechniqueHint` with `action === 'elimination'`.
2. WHEN a box/line reduction is found, THE `hint.primaryCells` SHALL contain the cells in the row/column within the box.
3. WHEN a box/line reduction is found, THE `hint.eliminations` SHALL remove the digit from cells in the box that are outside the row/column.
4. WHEN no box/line reduction with useful eliminations exists, THE function SHALL return `null`.

---

### Requirement 8: Technique Detection Pipeline

**User Story:** As a developer, I want a single entry point that tries all technique detectors in priority order, so that the hint system always returns the simplest applicable technique.

#### Acceptance Criteria

1. THE `findTechniqueHint` function SHALL try detectors in this order: Naked Single → Hidden Single → Naked Pair → Hidden Pair → Pointing Pair → Box/Line Reduction.
2. THE function SHALL return the result of the first detector that returns a non-null hint.
3. WHEN all detectors return null, THE function SHALL return `null`.
4. WHEN called with a board where every cell is filled, THE function SHALL return `null`.
5. THE function SHALL produce no mutations to the input board, candidates, or solution.

---

### Requirement 9: Technique Hint Structure

**User Story:** As a developer, I want a well-defined hint structure, so that the UI can consistently display any technique type.

#### Acceptance Criteria

1. FOR placement hints, THE `TechniqueHint` SHALL have `action === 'placement'`, exactly one entry in `primaryCells`, and `eliminations` undefined.
2. FOR elimination hints, THE `TechniqueHint` SHALL have `action === 'elimination'` and a non-empty `eliminations` array where each entry specifies a cell and at least one digit.
3. FOR all hints, THE `primaryCells` array SHALL be non-empty.
4. FOR all hints, THE `digit` field SHALL be in range [1, 9].
5. FOR all elimination hints, every digit in `eliminations` SHALL be an actual candidate in the target cell's candidate set.

---

### Requirement 10: Hint Button UI

**User Story:** As a player, I want to see a hint button with a remaining-count label, so that I know how many hints I have left and can request one when stuck.

#### Acceptance Criteria

1. THE NumberPad SHALL render a "Hint" button that displays the current `hintsRemaining` count.
2. WHEN `hintsRemaining === 0`, THE hint button SHALL be disabled.
3. WHILE `screen !== 'playing'`, THE hint button SHALL be disabled.
4. WHEN `solutions` has not been loaded, THE hint button SHALL be disabled.
5. WHEN `activeHint` is non-null (a hint is already displayed), THE hint button SHALL be disabled.

---

### Requirement 11: Hint Panel Display

**User Story:** As a player, I want to see a panel explaining the detected technique, so that I understand the solving logic rather than just getting an answer.

#### Acceptance Criteria

1. WHEN `activeHint` is non-null, THE App SHALL render the HintPanel component.
2. THE HintPanel SHALL display the technique name and difficulty rating (e.g., "Naked Single — Easy").
3. THE HintPanel SHALL display a human-readable explanation of why the technique applies.
4. THE HintPanel SHALL render an "Apply" button that triggers `handleApplyHint`.
5. THE HintPanel SHALL render a "Dismiss" button (or ×) that triggers `handleDismissHint`.
6. WHEN `activeHint` is null, THE App SHALL NOT render the HintPanel.

---

### Requirement 12: Multi-Cell Technique Highlighting

**User Story:** As a player, I want the grid to highlight the cells involved in a technique, so that I can visually understand which cells are relevant.

#### Acceptance Criteria

1. WHEN `activeHint` is non-null, THE Grid SHALL apply a green/teal highlight to all `primaryCells`.
2. WHEN `activeHint` is non-null, THE Grid SHALL apply a lighter blue/cyan highlight to all `secondaryCells`.
3. THE technique highlight SHALL take visual precedence over the selection highlight.
4. THE technique highlight SHALL NOT take precedence over the conflict highlight.
5. WHEN `activeHint` is null, THE Grid SHALL NOT apply any technique highlighting.

---

### Requirement 13: Hint Request Flow

**User Story:** As a player, I want to request a hint that shows me a technique without immediately changing the board, so that I can learn before deciding to apply.

#### Acceptance Criteria

1. WHEN the player clicks the hint button, THE App SHALL call `buildCandidateBoard` and `findTechniqueHint`.
2. WHEN a technique is found, THE App SHALL set `activeHint` to the returned hint and increment `hintsUsed` by 1.
3. WHEN a technique is found, THE App SHALL NOT modify the board or notes until the player clicks "Apply".
4. WHEN no technique is found, THE App SHALL NOT set `activeHint` or increment `hintsUsed`.
5. WHEN `hintsUsed >= MAX_HINTS`, THE `handleHint` function SHALL return without any side effects.
6. WHEN `solutions === null`, THE `handleHint` function SHALL return without any side effects.
7. WHEN `activeHint` is already non-null, THE `handleHint` function SHALL return without any side effects.

---

### Requirement 14: Hint Application — Placement

**User Story:** As a player, I want to apply a placement hint to fill in the correct digit, so that the technique's result is reflected on the board.

#### Acceptance Criteria

1. WHEN the player clicks "Apply" on a placement hint, THE App SHALL push an undo snapshot before modifying state.
2. THE App SHALL place `hint.digit` into `board[row][col]` for the primary cell.
3. THE App SHALL clear all notes for the primary cell.
4. THE App SHALL remove `hint.digit` from the notes of every peer of the primary cell.
5. THE App SHALL recalculate conflicts via `updateConflicts`.
6. THE App SHALL set `activeHint` to `null` and clear technique highlights.
7. THE App SHALL call `checkCompletion` to detect if the puzzle is now solved.

---

### Requirement 15: Hint Application — Elimination

**User Story:** As a player, I want to apply an elimination hint to remove incorrect candidates from my notes, so that the technique's result simplifies my note state.

#### Acceptance Criteria

1. WHEN the player clicks "Apply" on an elimination hint, THE App SHALL push an undo snapshot before modifying state.
2. THE App SHALL remove the specified digits from the notes of each cell listed in `hint.eliminations`.
3. THE App SHALL NOT modify any cell values on the board.
4. THE App SHALL set `activeHint` to `null` and clear technique highlights.
5. THE App SHALL recalculate conflicts via `updateConflicts`.

---

### Requirement 16: Hint Dismissal

**User Story:** As a player, I want to dismiss a hint without applying it, so that I can continue solving on my own after reading the explanation.

#### Acceptance Criteria

1. WHEN the player clicks "Dismiss" on the HintPanel, THE App SHALL set `activeHint` to `null`.
2. THE App SHALL clear all technique highlights from the Grid.
3. THE App SHALL NOT decrement `hintsUsed` — the hint was consumed when requested.
4. THE App SHALL NOT modify the board or notes.

---

### Requirement 17: Hint Cap Enforcement

**User Story:** As a game designer, I want hints to be limited per session, so that the game remains a meaningful challenge.

#### Acceptance Criteria

1. THE App SHALL enforce a maximum of `MAX_HINTS` (3) hints per session.
2. WHEN `hintsUsed >= MAX_HINTS`, THE App SHALL prevent `handleHint` from executing any side effects.
3. WHEN `hintsUsed >= MAX_HINTS`, THE hint button SHALL be disabled.
4. THE `hintsUsed` counter SHALL never exceed `MAX_HINTS` regardless of how many times `handleHint` is invoked.

---

### Requirement 18: Stale Hint Protection

**User Story:** As a developer, I want the system to handle the case where the board changes between hint request and hint application, so that stale hints don't corrupt the game state.

#### Acceptance Criteria

1. WHEN `handleApplyHint` is called for a placement hint and the primary cell is no longer empty, THE App SHALL dismiss the hint without modifying the board.
2. WHEN `handleApplyHint` is called and `activeHint` is null, THE function SHALL return without side effects.

---

### Requirement 19: Undo Integration

**User Story:** As a player, I want to undo a hint application, so that I can reverse the technique's effect if I change my mind.

#### Acceptance Criteria

1. WHEN a hint is applied (placement or elimination), THE App SHALL push an undo snapshot capturing the board, notes, and hintsUsed before mutation.
2. WHEN the player undoes after a hint application, THE board, notes, and hintsUsed SHALL be restored to their exact pre-application values.
3. THE undo system SHALL treat hint applications identically to manual digit placements.

---

### Requirement 20: Error and Edge-Case Handling

**User Story:** As a player, I want the hint system to degrade gracefully in unexpected situations, so that the game remains playable even if hints are unavailable.

#### Acceptance Criteria

1. IF `solutions` is `null` when a hint is requested, THEN THE App SHALL return from `handleHint` without modifying any state.
2. IF `findTechniqueHint` returns `null`, THEN THE App SHALL return from `handleHint` without setting `activeHint` or incrementing `hintsUsed`.
3. IF the API response is missing the `solutions` field, THEN THE App SHALL remain fully playable without hints.
4. WHEN a placement hint places a value that conflicts with existing peer values, THE App SHALL still apply the hint and display the conflict via the existing conflict-highlight mechanism.
