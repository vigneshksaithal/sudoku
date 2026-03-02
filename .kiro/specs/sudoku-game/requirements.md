# Requirements Document

## Introduction

A playable Sudoku puzzle embedded in a Reddit post via Devvit. Each post contains three fully independent puzzles (easy, medium, hard), each with a unique solution. Users select a difficulty, solve the 9×9 grid through tap-based input, and receive pass/fail feedback on submission. No timer, leaderboard, progress saving, or notes.

## Glossary

- **Sudoku_App**: The Devvit application that serves Sudoku puzzles inside Reddit custom posts
- **Generator**: The server-side module responsible for creating valid Sudoku solutions and puzzles
- **Solver**: The backtracking algorithm that fills empty cells to complete a Sudoku board
- **Validator**: The component that checks whether a number placement satisfies Sudoku constraints (row, column, and 3×3 box uniqueness)
- **Puzzle**: A 9×9 grid with some cells pre-filled (givens) and the rest blank, derived from a complete solution by removing cells
- **Solution**: A fully completed 9×9 grid where every row, column, and 3×3 box contains the digits 1–9 exactly once
- **Given**: A pre-filled cell in a puzzle that the user cannot modify
- **Board_String**: An 81-character string representation of a 9×9 grid, where each character is a digit 0–9 (0 = blank)
- **Difficulty**: One of three levels (easy, medium, hard) that determines how many cells are removed from the solution
- **Conflict**: A state where a user-placed digit duplicates another digit in the same row, column, or 3×3 box
- **Grid**: The 9×9 Svelte component that renders the Sudoku board and handles cell selection
- **NumberPad**: The input component providing buttons 1–9 and an erase action
- **Redis_Store**: The Devvit Redis hash storing puzzle and solution data keyed by post ID
- **Post_Creator**: The server-side handler that generates puzzles and submits the Reddit custom post
- **Client**: The Svelte 5 webview application running inside the Devvit post sandbox

## Requirements

### Requirement 1: Sudoku Solution Generation

**User Story:** As a moderator, I want each post to contain valid Sudoku solutions, so that players always have a solvable puzzle.

#### Acceptance Criteria

1. WHEN a new post is created, THE Generator SHALL produce a complete 9×9 Solution where every row contains the digits 1–9 exactly once
2. WHEN a new post is created, THE Generator SHALL produce a complete 9×9 Solution where every column contains the digits 1–9 exactly once
3. WHEN a new post is created, THE Generator SHALL produce a complete 9×9 Solution where every 3×3 box contains the digits 1–9 exactly once
4. WHEN generating a Solution, THE Generator SHALL fill the three diagonal 3×3 boxes independently with shuffled digits 1–9 before solving the remaining cells via backtracking
5. WHEN a new post is created, THE Generator SHALL produce three independent Solutions, one for each Difficulty level

### Requirement 2: Puzzle Creation via Hole Punching

**User Story:** As a moderator, I want puzzles at different difficulty levels, so that players of varying skill can enjoy the game.

#### Acceptance Criteria

1. WHEN creating an easy Puzzle, THE Generator SHALL remove 35 cells from the Solution, leaving 46 Givens
2. WHEN creating a medium Puzzle, THE Generator SHALL remove 45 cells from the Solution, leaving 36 Givens
3. WHEN creating a hard Puzzle, THE Generator SHALL remove 54 cells from the Solution, leaving 27 Givens
4. WHEN removing a cell during Puzzle creation, THE Generator SHALL verify the Puzzle retains exactly one solution using a counting Solver that stops at 2
5. WHEN a cell removal would result in multiple solutions, THE Generator SHALL restore the cell value and skip that cell
6. IF the Generator cannot remove the target number of cells, THEN THE Generator SHALL accept the current Puzzle state as valid

### Requirement 3: Puzzle and Solution Storage

**User Story:** As a developer, I want puzzle data persisted in Redis, so that puzzles survive page reloads and are available to all users viewing the post.

#### Acceptance Criteria

1. WHEN a new post is created, THE Post_Creator SHALL store all three Puzzle Board_Strings and their corresponding Solution Board_Strings in the Redis_Store under the key `puzzle:{postId}`
2. THE Redis_Store SHALL store each Board_String as an 81-character string of digits 0–9
3. WHEN a new post is created, THE Post_Creator SHALL store a `createdAt` timestamp in the Redis_Store hash
4. THE Redis_Store SHALL use hash fields named `{difficulty}:solution` and `{difficulty}:puzzle` for each Difficulty level

### Requirement 4: Puzzle Retrieval API

**User Story:** As a player, I want to load the puzzle when I open the post, so that I can start playing immediately.

#### Acceptance Criteria

1. WHEN the Client sends a GET request to `/api/puzzle`, THE Sudoku_App SHALL return the Puzzle Board_Strings for all three Difficulty levels
2. WHEN the Client sends a GET request to `/api/puzzle`, THE Sudoku_App SHALL read the post ID from the Devvit context
3. WHEN the Client sends a GET request to `/api/puzzle`, THE Sudoku_App SHALL omit the Solution Board_Strings from the response
4. IF the requested puzzle data does not exist in the Redis_Store, THEN THE Sudoku_App SHALL return an error response with a descriptive message

### Requirement 5: Board Validation API

**User Story:** As a player, I want to submit my completed board for validation, so that I know whether my solution is correct.

#### Acceptance Criteria

1. WHEN the Client sends a POST request to `/api/validate` with a board and Difficulty, THE Sudoku_App SHALL compare the submitted board against the stored Solution
2. WHEN the submitted board matches the stored Solution, THE Sudoku_App SHALL return `{ valid: true }`
3. WHEN the submitted board does not match the stored Solution, THE Sudoku_App SHALL return `{ valid: false }`
4. IF the POST request to `/api/validate` is missing the board or Difficulty field, THEN THE Sudoku_App SHALL return an error response with status 400

### Requirement 6: Post Creation Flow

**User Story:** As a moderator, I want to create a Sudoku post from the subreddit menu, so that I can publish puzzles for my community.

#### Acceptance Criteria

1. WHEN a moderator clicks "Create a new post" from the subreddit menu, THE Post_Creator SHALL generate three independent Puzzles (one per Difficulty)
2. WHEN all three Puzzles are generated and stored, THE Post_Creator SHALL submit a Reddit custom post with the title "Sudoku"
3. WHEN the custom post is submitted, THE Post_Creator SHALL return a navigation URL to the new post
4. IF an error occurs during post creation, THEN THE Post_Creator SHALL return an error response with a descriptive message

### Requirement 7: Difficulty Selection Screen

**User Story:** As a player, I want to choose a difficulty level before playing, so that I can pick a challenge appropriate for my skill.

#### Acceptance Criteria

1. WHEN the Client loads inside a post, THE Client SHALL display a Difficulty selection screen with three options: easy, medium, and hard
2. WHEN the player selects a Difficulty, THE Client SHALL transition from the "picking" state to the "playing" state
3. WHEN the player selects a Difficulty, THE Client SHALL load and display the corresponding Puzzle

### Requirement 8: Grid Display and Cell Selection

**User Story:** As a player, I want to see the Sudoku grid and select cells, so that I can place numbers to solve the puzzle.

#### Acceptance Criteria

1. THE Grid SHALL render a 9×9 board with visible 3×3 box boundaries
2. WHEN the player taps a cell, THE Grid SHALL mark that cell as selected with a visual indicator
3. THE Grid SHALL display Given cells with a visually distinct style from user-editable cells
4. THE Grid SHALL render each cell with a minimum touch target of 36×36 pixels
5. THE Grid SHALL fit within the 512px post height constraint

### Requirement 9: Number Input

**User Story:** As a player, I want to enter numbers into cells, so that I can fill in the puzzle.

#### Acceptance Criteria

1. THE NumberPad SHALL display buttons for digits 1 through 9 and an erase action
2. WHEN the player taps a NumberPad digit while a user-editable cell is selected, THE Client SHALL place that digit in the selected cell
3. WHEN the player taps the erase action while a user-editable cell is selected, THE Client SHALL clear the selected cell
4. WHEN the player taps a NumberPad digit while a Given cell is selected, THE Client SHALL not modify the Given cell

### Requirement 10: Conflict Detection

**User Story:** As a player, I want to see when I place a conflicting number, so that I can correct my mistakes.

#### Acceptance Criteria

1. WHEN a digit is placed in a cell, THE Client SHALL scan the same row for duplicate digits and highlight Conflicts in red
2. WHEN a digit is placed in a cell, THE Client SHALL scan the same column for duplicate digits and highlight Conflicts in red
3. WHEN a digit is placed in a cell, THE Client SHALL scan the same 3×3 box for duplicate digits and highlight Conflicts in red
4. WHEN a conflicting digit is removed or changed, THE Client SHALL remove the Conflict highlighting from affected cells

### Requirement 11: Completion and Submission

**User Story:** As a player, I want to know when I have completed the puzzle correctly, so that I get feedback on my effort.

#### Acceptance Criteria

1. WHEN all 81 cells are non-zero and no Conflicts exist, THE Client SHALL send a POST request to `/api/validate` with the current board and Difficulty
2. WHEN the validation response is `{ valid: true }`, THE Client SHALL transition to the "completed" state and display a success message
3. WHEN the validation response is `{ valid: false }`, THE Client SHALL display a failure message and remain in the "playing" state

### Requirement 12: Light and Dark Mode Support

**User Story:** As a player, I want the game to respect my Reddit theme preference, so that the UI is comfortable to read.

#### Acceptance Criteria

1. THE Client SHALL render the Grid and NumberPad using colors that adapt to the user's light or dark mode preference via Tailwind CSS
2. THE Client SHALL maintain sufficient contrast between Given cells, user-editable cells, selected cells, and Conflict-highlighted cells in both light and dark modes

### Requirement 13: Board String Serialization

**User Story:** As a developer, I want a consistent board format, so that the server and client can exchange puzzle data reliably.

#### Acceptance Criteria

1. THE Sudoku_App SHALL represent every board as an 81-character Board_String where each character is a digit 0–9
2. THE Sudoku_App SHALL map Board_String index `i` to row `floor(i / 9)` and column `i mod 9`
3. FOR ALL valid board states, converting a 9×9 grid to a Board_String and back to a 9×9 grid SHALL produce an equivalent board (round-trip property)

### Requirement 14: Test-Driven Development

**User Story:** As a developer, I want all server logic, shared utilities, and client logic covered by automated tests written before implementation, so that correctness is verified continuously and regressions are caught immediately.

#### Acceptance Criteria

1. WHEN implementing any server route, helper, or business logic module, THE Developer SHALL write a failing test in a colocated `__tests__/*.test.ts` file before writing the implementation code
2. THE Sudoku_App SHALL pass all tests via `bun run test` (Vitest) with zero failures before each implementation checkpoint
3. THE Sudoku_App SHALL use `@devvit/test` with `createDevvitTest()` for all server integration tests requiring Redis or Reddit API access
4. THE Sudoku_App SHALL use `fast-check` for property-based tests that verify the correctness properties defined in the design document
5. WHEN a test for a module does not yet exist, THE Developer SHALL create the test file and write failing tests before writing any implementation code for that module
6. THE Sudoku_App SHALL maintain test files matching the pattern `src/**/__tests__/**/*.test.ts` as required by the Vitest configuration
7. WHEN all sub-tasks within an implementation task are complete, THE Developer SHALL run `bun run test && bun run type-check` and confirm zero failures before proceeding to the next task
