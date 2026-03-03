# Requirements Document

## Introduction

Replace the current brute-force Sudoku generation and validation engine with a QQWing-style candidate-elimination solver. The new engine provides technique-based difficulty grading (4 tiers instead of 3), a solve history log for future hint support, optional symmetric clue removal for aesthetically pleasing puzzles, and improved puzzle quality. The solver is a drop-in replacement for `src/server/lib/sudoku.ts` — Redis schema shape, API route structure, and client component architecture remain unchanged.

## Glossary

- **Solver**: The candidate-elimination engine that solves Sudoku puzzles by applying logical techniques in a fixed order, falling back to guess-and-backtrack when logic is exhausted
- **Candidate**: A digit 1–9 that remains possible for a given cell; stored in the possibilities array
- **Possibilities_Array**: A flat array of 729 entries (81 cells × 9 values) tracking which candidates remain for each cell; a zero value means the candidate is still possible, a non-zero value stores the round number in which the candidate was eliminated
- **Solution_Array**: A flat array of 81 entries storing the placed value for each cell (0 = unsolved)
- **Round**: An integer tagging every elimination and placement for rollback support; even rounds represent logical deductions, odd rounds represent guesses
- **Naked_Single**: A cell with exactly one remaining candidate
- **Hidden_Single**: A candidate that appears in only one cell within a house (row, column, or box)
- **Naked_Pair**: Two cells in the same house sharing exactly the same two candidates and no others
- **Pointing_Pair_Triple**: A candidate confined to a single row or column within a box, allowing elimination from the rest of that row or column
- **Box_Line_Reduction**: A candidate confined to a single box within a row or column, allowing elimination from the rest of that box
- **Hidden_Pair**: Two candidates that appear in only the same two cells within a house, allowing elimination of all other candidates from those two cells
- **House**: A row, column, or 3×3 box — any group of 9 cells that must contain digits 1–9 exactly once
- **Peer**: Any cell sharing a house with a given cell (each cell has exactly 20 peers)
- **Symmetry**: A pattern for removing clues in pairs or groups to produce visually balanced puzzles
- **Solve_Log**: An ordered list of LogItem entries recording every placement, elimination technique, guess, and rollback during a solve
- **Difficulty**: One of four tiers — simple, easy, intermediate, expert — determined by the most advanced technique required to solve a puzzle
- **Generator**: The subsystem that produces a random complete solution, then removes clues while preserving unique solvability
- **Puzzle_Engine**: The combined Solver, Generator, difficulty classifier, and solve history system

## Requirements

### Requirement 1: Core Data Structures and Index Math

**User Story:** As a developer, I want flat-array data structures with deterministic index math, so that the solver operates efficiently without nested array overhead and supports round-based rollback.

#### Acceptance Criteria

1. THE Puzzle_Engine SHALL represent cell values in a Solution_Array of 81 entries where index `i` maps to row `floor(i / 9)` and column `i % 9`
2. THE Puzzle_Engine SHALL represent candidates in a Possibilities_Array of 729 entries where index `valueIndex + (9 * cell)` maps value `valueIndex + 1` for cell `cell`
3. WHEN a candidate is eliminated, THE Puzzle_Engine SHALL store the current round number at the corresponding Possibilities_Array index
4. THE Puzzle_Engine SHALL compute cell-to-row as `floor(cell / 9)`, cell-to-column as `cell % 9`, and cell-to-box as `floor(row / 3) * 3 + floor(col / 3)` for all cell indices 0–80
5. THE Puzzle_Engine SHALL identify exactly 20 peers for each cell (cells sharing the same row, column, or box, excluding the cell itself)

### Requirement 2: Mark and Rollback Operations

**User Story:** As a developer, I want mark and rollback operations on the candidate arrays, so that the solver can place values and undo guesses without corrupting state.

#### Acceptance Criteria

1. WHEN the Solver marks a value at a position with a given round, THE Solver SHALL set `solution[position]` to that value, eliminate that value from all 20 peers, and eliminate all other candidates from that position
2. WHEN the Solver marks a value, THE Solver SHALL tag every elimination with the current round number in the Possibilities_Array
3. WHEN the Solver rolls back a round, THE Solver SHALL reset every Solution_Array entry placed during that round to 0 and reset every Possibilities_Array entry tagged with that round to 0
4. WHEN the Solver rolls back a round, THE Solver SHALL remove all Solve_Log entries from that round
5. FOR ALL valid mark-then-rollback sequences, rolling back a round SHALL restore the Solution_Array and Possibilities_Array to their state before that round began (round-trip property)

### Requirement 3: Naked Single Technique

**User Story:** As a developer, I want the solver to detect naked singles, so that cells with only one remaining candidate are solved immediately.

#### Acceptance Criteria

1. WHEN a cell has exactly one remaining candidate in the Possibilities_Array, THE Solver SHALL place that candidate using the mark operation
2. WHEN the Solver places a Naked_Single, THE Solve_Log SHALL record an entry with type `single`, the placed value, and the cell position
3. THE Solver SHALL check all 81 cells for naked singles in a single pass before moving to the next technique

### Requirement 4: Hidden Single Technique

**User Story:** As a developer, I want the solver to detect hidden singles in rows, columns, and boxes, so that candidates appearing in only one cell within a house are placed.

#### Acceptance Criteria

1. WHEN a candidate value appears in exactly one cell within a 3×3 box, THE Solver SHALL place that value in that cell
2. WHEN a candidate value appears in exactly one cell within a row, THE Solver SHALL place that value in that cell
3. WHEN a candidate value appears in exactly one cell within a column, THE Solver SHALL place that value in that cell
4. WHEN the Solver places a Hidden_Single, THE Solve_Log SHALL record an entry with the appropriate type (`hiddenSingleSection`, `hiddenSingleRow`, or `hiddenSingleColumn`), the placed value, and the cell position
5. THE Solver SHALL check boxes before rows, and rows before columns, for hidden singles

### Requirement 5: Naked Pair Technique

**User Story:** As a developer, I want the solver to detect naked pairs, so that shared candidates are eliminated from other cells in the same house.

#### Acceptance Criteria

1. WHEN two cells in the same row share exactly the same two candidates and no other candidates, THE Solver SHALL eliminate those two candidates from all other cells in that row
2. WHEN two cells in the same column share exactly the same two candidates and no other candidates, THE Solver SHALL eliminate those two candidates from all other cells in that column
3. WHEN two cells in the same box share exactly the same two candidates and no other candidates, THE Solver SHALL eliminate those two candidates from all other cells in that box
4. WHEN the Solver applies a Naked_Pair elimination, THE Solve_Log SHALL record an entry with the appropriate type (`nakedPairRow`, `nakedPairColumn`, or `nakedPairSection`)
5. THE Solver SHALL check rows, then columns, then boxes for naked pairs

### Requirement 6: Pointing Pair/Triple Technique

**User Story:** As a developer, I want the solver to detect pointing pairs and triples, so that candidates confined to a single row or column within a box are eliminated from the rest of that row or column.

#### Acceptance Criteria

1. WHEN a candidate value within a box appears only in cells that share the same row, THE Solver SHALL eliminate that candidate from all other cells in that row outside the box
2. WHEN a candidate value within a box appears only in cells that share the same column, THE Solver SHALL eliminate that candidate from all other cells in that column outside the box
3. WHEN the Solver applies a Pointing_Pair_Triple elimination, THE Solve_Log SHALL record an entry with type `pointingPairTripleRow` or `pointingPairTripleColumn`
4. THE Solver SHALL check row-based pointing reductions before column-based pointing reductions

### Requirement 7: Box/Line Reduction Technique

**User Story:** As a developer, I want the solver to detect box/line reductions, so that candidates confined to a single box within a row or column are eliminated from the rest of that box.

#### Acceptance Criteria

1. WHEN a candidate value within a row appears only in cells that share the same box, THE Solver SHALL eliminate that candidate from all other cells in that box outside the row
2. WHEN a candidate value within a column appears only in cells that share the same box, THE Solver SHALL eliminate that candidate from all other cells in that box outside the column
3. WHEN the Solver applies a Box_Line_Reduction, THE Solve_Log SHALL record an entry with type `rowBox` or `columnBox`
4. THE Solver SHALL check row-based box/line reductions before column-based box/line reductions

### Requirement 8: Hidden Pair Technique

**User Story:** As a developer, I want the solver to detect hidden pairs, so that when two candidates appear in only the same two cells within a house, all other candidates are eliminated from those cells.

#### Acceptance Criteria

1. WHEN two candidate values appear in exactly the same two cells within a row and in no other cells in that row, THE Solver SHALL eliminate all other candidates from those two cells
2. WHEN two candidate values appear in exactly the same two cells within a column and in no other cells in that column, THE Solver SHALL eliminate all other candidates from those two cells
3. WHEN two candidate values appear in exactly the same two cells within a box and in no other cells in that box, THE Solver SHALL eliminate all other candidates from those two cells
4. WHEN the Solver applies a Hidden_Pair elimination, THE Solve_Log SHALL record an entry with the appropriate type (`hiddenPairRow`, `hiddenPairColumn`, or `hiddenPairSection`)
5. THE Solver SHALL check rows, then columns, then boxes for hidden pairs

### Requirement 9: Technique Application Order

**User Story:** As a developer, I want techniques applied in a fixed priority order, so that difficulty classification is deterministic and consistent with QQWing's approach.

#### Acceptance Criteria

1. THE Solver SHALL apply techniques in this exact order per solve step: Naked_Single, Hidden_Single (box, row, column), Naked_Pair (row, column, box), Pointing_Pair_Triple (row, column), Box_Line_Reduction (row, column), Hidden_Pair (row, column, box)
2. WHEN a technique makes progress (places a value or eliminates a candidate), THE Solver SHALL restart the technique loop from the beginning
3. WHEN no technique makes progress, THE Solver SHALL fall back to guess-and-backtrack

### Requirement 10: Guess and Backtrack Fallback

**User Story:** As a developer, I want a guess-and-backtrack fallback, so that the solver can handle puzzles requiring techniques beyond the implemented set.

#### Acceptance Criteria

1. WHEN no logical technique makes progress and unsolved cells remain, THE Solver SHALL select the unsolved cell with the fewest remaining candidates
2. WHEN guessing, THE Solver SHALL try each remaining candidate for the selected cell in a randomized order
3. WHEN a guess leads to a contradiction (a cell with zero remaining candidates), THE Solver SHALL roll back the guess round and all subsequent rounds, then try the next candidate
4. WHEN the Solver places a guess, THE Solve_Log SHALL record an entry with type `guess`
5. WHEN the Solver rolls back a guess, THE Solve_Log SHALL record an entry with type `rollback`
6. THE Solver SHALL use odd round numbers for guesses and even round numbers for logical deductions

### Requirement 11: Solve Loop

**User Story:** As a developer, I want a complete solve loop that combines logical techniques with guess fallback, so that any valid Sudoku puzzle can be solved.

#### Acceptance Criteria

1. THE Solver SHALL repeatedly apply `singleSolveMove` until the puzzle is solved, impossible, or no technique makes progress
2. WHEN the puzzle is solved (all 81 cells have values), THE Solver SHALL return true
3. WHEN the puzzle is impossible (any cell has zero remaining candidates and no value), THE Solver SHALL return false
4. WHEN logic is exhausted, THE Solver SHALL enter guess mode, incrementing the round number appropriately
5. FOR ALL valid Sudoku puzzles with a unique solution, THE Solver SHALL find that solution

### Requirement 12: Solution Generation

**User Story:** As a developer, I want to generate random complete Sudoku solutions, so that puzzles can be created from valid filled grids.

#### Acceptance Criteria

1. THE Generator SHALL produce a complete valid 9×9 Sudoku solution by solving an empty grid with randomized candidate ordering
2. THE Generator SHALL shuffle both the cell visit order and the digit try order using Fisher-Yates before solving
3. FOR ALL generated solutions, every row, column, and 3×3 box SHALL contain digits 1–9 exactly once
4. THE Generator SHALL produce different solutions across multiple invocations (non-deterministic output)

### Requirement 13: Puzzle Generation with Clue Removal

**User Story:** As a developer, I want to generate puzzles by removing clues from a complete solution while preserving unique solvability, so that each puzzle has exactly one valid solution.

#### Acceptance Criteria

1. THE Generator SHALL remove clues from a complete solution one at a time (or in symmetric groups), checking unique solvability after each removal
2. WHEN removing a clue would result in multiple solutions, THE Generator SHALL restore that clue
3. THE Generator SHALL use `countSolutions` with a limit of 2 to verify unique solvability after each removal
4. FOR ALL generated puzzles, THE Solver SHALL find exactly one solution
5. WHEN symmetry is specified, THE Generator SHALL remove clues in symmetric pairs or groups according to the selected symmetry pattern

### Requirement 14: Symmetry Support

**User Story:** As a developer, I want optional symmetric clue removal, so that generated puzzles have visually balanced clue patterns.

#### Acceptance Criteria

1. THE Generator SHALL support five symmetry modes: NONE, ROTATE180, ROTATE90, MIRROR, and FLIP
2. WHEN ROTATE180 symmetry is selected, THE Generator SHALL remove each clue together with its 180-degree rotation partner
3. WHEN ROTATE90 symmetry is selected, THE Generator SHALL remove each clue together with its 90-degree, 180-degree, and 270-degree rotation partners
4. WHEN MIRROR symmetry is selected, THE Generator SHALL remove each clue together with its horizontal mirror partner
5. WHEN FLIP symmetry is selected, THE Generator SHALL remove each clue together with its vertical mirror partner
6. WHEN NONE symmetry is selected, THE Generator SHALL remove clues individually in random order
7. THE Generator SHALL default to ROTATE180 symmetry when no symmetry mode is specified

### Requirement 15: Difficulty Classification

**User Story:** As a developer, I want technique-based difficulty classification, so that puzzles are graded by the solving techniques they require rather than by clue count.

#### Acceptance Criteria

1. WHEN the Solve_Log contains guess entries, THE Puzzle_Engine SHALL classify the puzzle as `expert`
2. WHEN the Solve_Log contains Box_Line_Reduction, Pointing_Pair_Triple, Naked_Pair, or Hidden_Pair entries but no guess entries, THE Puzzle_Engine SHALL classify the puzzle as `intermediate`
3. WHEN the Solve_Log contains only Hidden_Single and Naked_Single entries, THE Puzzle_Engine SHALL classify the puzzle as `easy`
4. WHEN the Solve_Log contains only Naked_Single entries, THE Puzzle_Engine SHALL classify the puzzle as `simple`
5. THE Puzzle_Engine SHALL determine difficulty by solving the puzzle with history recording enabled and inspecting the Solve_Log after completion

### Requirement 16: Difficulty-Targeted Generation

**User Story:** As a developer, I want to generate puzzles targeting a specific difficulty level, so that each difficulty option in the UI produces appropriately challenging puzzles.

#### Acceptance Criteria

1. WHEN a target difficulty is requested, THE Generator SHALL generate puzzles in a retry loop until a puzzle matching the target difficulty is produced
2. THE Generator SHALL limit retry attempts to a configurable maximum to stay within Devvit's 30-second execution limit
3. IF the Generator exhausts retry attempts without finding an exact match, THEN THE Generator SHALL return the closest puzzle generated during the retry loop
4. THE Generator SHALL produce all four difficulty levels (simple, easy, intermediate, expert) at post creation time

### Requirement 17: Solve History Log

**User Story:** As a developer, I want a structured solve history log, so that difficulty classification works and a future hint system has step-by-step data.

#### Acceptance Criteria

1. THE Solve_Log SHALL record a LogItem for every placement, technique application, guess, and rollback during a solve
2. WHEN history recording is enabled, each LogItem SHALL contain the round number, technique type, value (0 if not applicable), and cell position (-1 if not applicable)
3. THE Solve_Log SHALL support these technique types: `given`, `single`, `hiddenSingleRow`, `hiddenSingleColumn`, `hiddenSingleSection`, `nakedPairRow`, `nakedPairColumn`, `nakedPairSection`, `pointingPairTripleRow`, `pointingPairTripleColumn`, `rowBox`, `columnBox`, `hiddenPairRow`, `hiddenPairColumn`, `hiddenPairSection`, `guess`, `rollback`
4. WHEN the Solver rolls back a round, THE Solve_Log SHALL remove all entries from that round
5. THE Puzzle_Engine SHALL provide solve statistics (count of each technique type used) derived from the Solve_Log

### Requirement 18: Difficulty Type Update

**User Story:** As a developer, I want the Difficulty type updated to four levels, so that the client and server use the new classification consistently.

#### Acceptance Criteria

1. THE Puzzle_Engine SHALL define the Difficulty type as `'simple' | 'easy' | 'intermediate' | 'expert'`
2. WHEN the Difficulty type changes, THE Puzzle_Engine SHALL update all server-side references (route validation, post creation, Redis key prefixes) to use the four new levels
3. WHEN the Difficulty type changes, THE Puzzle_Engine SHALL update the client-side difficulty picker to display four options: Simple, Easy, Intermediate, Expert

### Requirement 19: API Route Integration

**User Story:** As a developer, I want the API routes updated for the new difficulty levels, so that puzzle fetching and validation work with four difficulties.

#### Acceptance Criteria

1. THE `/api/puzzle` route SHALL return puzzle data for all four difficulty levels (simple, easy, intermediate, expert)
2. THE `/api/validate` route SHALL accept all four difficulty levels as valid input
3. IF an invalid difficulty value is provided to `/api/validate`, THEN THE route SHALL return an error response with status 400
4. THE `/api/puzzle` route SHALL return an error if any of the four difficulty puzzles is missing from Redis

### Requirement 20: Post Creation Integration

**User Story:** As a developer, I want post creation to generate four puzzles using the new engine, so that each post has one puzzle per difficulty level.

#### Acceptance Criteria

1. WHEN a post is created, THE post creation handler SHALL generate four puzzles targeting simple, easy, intermediate, and expert difficulties
2. THE post creation handler SHALL store each puzzle and its solution in Redis using the pattern `{difficulty}:puzzle` and `{difficulty}:solution`
3. THE post creation handler SHALL complete puzzle generation for all four difficulties within Devvit's 30-second execution limit
4. THE post creation handler SHALL use ROTATE180 symmetry as the default for puzzle generation

### Requirement 21: Client Difficulty Picker Update

**User Story:** As a player, I want to choose from four difficulty levels, so that I can select a challenge appropriate to my skill level.

#### Acceptance Criteria

1. THE difficulty picker SHALL display four buttons: Simple, Easy, Intermediate, Expert
2. WHEN a player selects a difficulty, THE client SHALL load and display the corresponding puzzle
3. THE difficulty picker SHALL replace the existing three-button layout (easy, medium, hard) with the four-button layout

### Requirement 22: Board Serialization Compatibility

**User Story:** As a developer, I want board serialization to remain compatible, so that the existing 81-character string format continues to work across the system.

#### Acceptance Criteria

1. THE Puzzle_Engine SHALL serialize puzzles as 81-character strings where each character is a digit 0–9 (0 = empty cell)
2. THE Puzzle_Engine SHALL parse 81-character strings into the internal flat-array representation
3. FOR ALL valid puzzles, serializing then parsing SHALL produce an equivalent internal representation (round-trip property)
