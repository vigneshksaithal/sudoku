# Requirements Document

## Introduction

This document captures the requirements for the Number Pad UI Overhaul feature of the Sudoku game. The feature addresses four user-reported issues: digit highlighting that disappears when clicking empty cells, a non-functional "Try another difficulty" button, an awkward number pad layout for mobile thumb reach, and the lack of visual feedback when all instances of a digit are placed on the board.

## Glossary

- **App**: The root Svelte component (`App.svelte`) that manages game state, screen transitions, and user interactions.
- **Grid**: The Svelte component (`Grid.svelte`) that renders the 9×9 Sudoku board with cell highlighting.
- **NumberPad**: The Svelte component (`NumberPad.svelte`) that provides digit entry buttons and action controls.
- **Highlight_Digit**: The currently highlighted digit value (1-9) or null, used to visually emphasize all matching cells on the Grid.
- **Pad_Alignment**: A user preference (`'left'` or `'right'`) controlling whether the digit grid appears on the left or right side of the NumberPad.
- **Digit_Count**: The number of times a specific digit (1-9) appears on the board.
- **Solved_Digit**: A digit whose Digit_Count equals 9, meaning all instances are placed on the board.
- **Expanded_Mode**: The Devvit platform's full-screen webview mode in which the game runs.
- **Preview**: The inline post view that shows difficulty selection buttons before launching the game.
- **Action_Column**: The vertical column of control buttons (Undo, Notes, Hint, Erase, Alignment toggle) in the NumberPad.

## Requirements

### Requirement 1: Persistent Digit Highlighting

**User Story:** As a player, I want the digit highlighting to persist when I click empty cells, so that I can keep track of which digit I'm working with while filling in answers.

#### Acceptance Criteria

1. WHEN a player clicks a cell containing a digit value, THE App SHALL set the Highlight_Digit to that cell's value.
2. WHEN a player clicks an empty cell (value 0), THE App SHALL retain the current Highlight_Digit without modification.
3. WHEN a player enters a digit via the NumberPad or keyboard, THE App SHALL set the Highlight_Digit to the entered digit.
4. WHEN a player presses the Escape key, THE App SHALL clear the Highlight_Digit to null.
5. WHEN a new game starts or the difficulty changes, THE App SHALL clear the Highlight_Digit to null.
6. THE App SHALL constrain the Highlight_Digit to either null or an integer in the range 1 through 9.

### Requirement 2: Return to Preview Navigation

**User Story:** As a player, I want the "Try another difficulty" button to navigate me back to the difficulty selection screen, so that I can start a new puzzle after completing one.

#### Acceptance Criteria

1. WHEN a player clicks the "Try another difficulty" button on the completed screen, THE App SHALL remove the difficulty key from localStorage.
2. WHEN a player clicks the "Try another difficulty" button on the completed screen, THE App SHALL call closeExpandedMode to collapse the Expanded_Mode back to the Preview.
3. IF closeExpandedMode is unavailable in the installed platform version, THEN THE App SHALL fall back to an alternative mechanism to return the player to the Preview.

### Requirement 3: NumberPad 3×3 Grid Layout

**User Story:** As a player, I want the number pad arranged in a 3×3 grid with a side-aligned action column, so that digits are easier to reach with my thumb on mobile.

#### Acceptance Criteria

1. THE NumberPad SHALL render digits 1 through 9 in a 3×3 grid using standard phone/calculator layout (1-2-3 top row, 4-5-6 middle row, 7-8-9 bottom row).
2. THE NumberPad SHALL render the Action_Column as a vertical column containing Undo, Notes, Hint, Erase, and alignment toggle buttons.
3. WHEN Pad_Alignment is set to 'left', THE NumberPad SHALL position the digit grid on the left and the Action_Column on the right.
4. WHEN Pad_Alignment is set to 'right', THE NumberPad SHALL position the Action_Column on the left and the digit grid on the right.
5. WHEN a player taps the alignment toggle button, THE NumberPad SHALL switch the Pad_Alignment to the opposite value.
6. WHEN the Pad_Alignment changes, THE App SHALL persist the preference to localStorage under the key 'sudoku-pad-alignment'.
7. WHEN the App initializes, THE App SHALL read the Pad_Alignment preference from localStorage, defaulting to 'left' if the key is absent.
8. IF localStorage is unavailable, THEN THE App SHALL default the Pad_Alignment to 'left' and skip persistence without displaying an error.

### Requirement 4: Solved Digit Fading

**User Story:** As a player, I want digits that have all 9 instances placed on the board to appear faded on the number pad, so that I can see at a glance which digits are complete.

#### Acceptance Criteria

1. THE App SHALL compute the Digit_Count for each digit 1 through 9 by counting occurrences on the board.
2. WHEN a digit's Digit_Count equals 9, THE NumberPad SHALL render that digit's button with reduced opacity (opacity-40) to indicate it is a Solved_Digit.
3. WHEN a digit's Digit_Count is less than 9, THE NumberPad SHALL render that digit's button at full opacity.
4. THE NumberPad SHALL keep Solved_Digit buttons clickable and not disabled, allowing the player to overwrite incorrect placements.
5. WHEN the board state changes, THE App SHALL recompute all Digit_Counts reactively.

### Requirement 5: Digit Count Calculation

**User Story:** As a developer, I want a pure utility function that counts digit placements on the board, so that the solved-digit fading logic is testable and decoupled from UI components.

#### Acceptance Criteria

1. THE countDigitPlacements function SHALL accept a 9×9 CellState board and return a Map with exactly 9 entries keyed by digits 1 through 9.
2. FOR EACH digit key in the returned Map, THE countDigitPlacements function SHALL set the value to the number of cells on the board containing that digit.
3. THE countDigitPlacements function SHALL not mutate the input board.
4. WHEN the board is empty (all cell values are 0), THE countDigitPlacements function SHALL return 0 for every digit key.
