# Requirements Document

## Introduction

Community Puzzle Submit allows Reddit users to contribute their own sudoku puzzles to the community. Users paste an 81-character puzzle string, the system validates it for correctness and unique solvability, automatically classifies its difficulty, and publishes it as a new Reddit custom post with full creator attribution and community engagement features. This transforms the app from a passive puzzle-consumption experience into an active community where players both solve and create.

## Glossary

- **Submission_Validator**: The server-side component that validates a puzzle string for format correctness, constraint compliance, and unique solvability
- **Difficulty_Classifier**: The server-side component that solves a puzzle with history recording and classifies its difficulty based on the techniques required
- **Puzzle_Submitter**: The server-side component that creates a Reddit custom post and stores puzzle data in Redis
- **Submit_UI**: The client-side Svelte interface where users paste puzzle strings, preview the grid, and confirm submission
- **Community_Puzzle**: A sudoku puzzle submitted by a community member, as opposed to an auto-generated puzzle
- **Puzzle_String**: An 81-character string of digits 0-9 where 0 represents an empty cell and 1-9 represent given digits
- **Creator**: The Reddit user who submitted a Community_Puzzle
- **Submission_Cooldown**: The minimum elapsed time required between consecutive puzzle submissions by a single user
- **Constraint_Violation**: A state where a given digit appears more than once in the same row, column, or 3x3 box
- **Solve_Count**: The number of unique users who have completed a Community_Puzzle

## Requirements

### Requirement 1: Puzzle Format Validation

**User Story:** As a puzzle creator, I want the system to validate my puzzle string format before processing, so that I receive immediate feedback on formatting errors.

#### Acceptance Criteria

1. WHEN a Puzzle_String is submitted, THE Submission_Validator SHALL verify the string is exactly 81 characters long
2. WHEN a Puzzle_String is submitted, THE Submission_Validator SHALL verify every character is a digit from 0 to 9
3. WHEN a Puzzle_String contains fewer than 17 non-zero digits, THE Submission_Validator SHALL reject the puzzle with a message indicating insufficient givens
4. IF a Puzzle_String fails format validation, THEN THE Submission_Validator SHALL return a descriptive error message identifying the specific violation
5. WHEN a Puzzle_String passes format validation, THE Submission_Validator SHALL proceed to constraint validation

### Requirement 2: Puzzle Constraint Validation

**User Story:** As a puzzle creator, I want the system to check my puzzle for sudoku rule violations, so that only rule-compliant puzzles are accepted.

#### Acceptance Criteria

1. WHEN a Puzzle_String passes format validation, THE Submission_Validator SHALL check all given digits for Constraint_Violations across rows, columns, and 3x3 boxes
2. IF a Constraint_Violation is detected, THEN THE Submission_Validator SHALL reject the puzzle with a message identifying the conflicting digit and its location
3. WHEN no Constraint_Violations are found, THE Submission_Validator SHALL proceed to uniqueness validation

### Requirement 3: Puzzle Uniqueness Validation

**User Story:** As a puzzle creator, I want the system to verify my puzzle has exactly one solution, so that solvers have a definitive answer to work toward.

#### Acceptance Criteria

1. WHEN a Puzzle_String passes constraint validation, THE Submission_Validator SHALL count the number of solutions up to a limit of 2
2. IF the Puzzle_String has zero solutions, THEN THE Submission_Validator SHALL reject the puzzle with a message indicating the puzzle is unsolvable
3. IF the Puzzle_String has more than one solution, THEN THE Submission_Validator SHALL reject the puzzle with a message indicating the puzzle has multiple solutions
4. WHEN the Puzzle_String has exactly one solution, THE Submission_Validator SHALL accept the puzzle and proceed to difficulty classification

### Requirement 4: Automatic Difficulty Classification

**User Story:** As a puzzle creator, I want the system to automatically determine my puzzle's difficulty, so that solvers know what to expect before starting.

#### Acceptance Criteria

1. WHEN a Puzzle_String passes uniqueness validation, THE Difficulty_Classifier SHALL solve the puzzle with technique history recording enabled
2. THE Difficulty_Classifier SHALL classify the puzzle as one of: simple, easy, intermediate, or expert, based on the most advanced solving technique required
3. WHEN classification is complete, THE Difficulty_Classifier SHALL return both the difficulty level and the solved board as the solution

### Requirement 5: Puzzle Preview

**User Story:** As a puzzle creator, I want to preview my puzzle as a rendered grid with its detected difficulty before submitting, so that I can verify it looks correct.

#### Acceptance Criteria

1. WHEN validation and classification succeed, THE Submit_UI SHALL display the puzzle rendered as a 9x9 sudoku grid with given digits filled in
2. WHEN the preview is displayed, THE Submit_UI SHALL show the detected difficulty level prominently
3. WHEN the preview is displayed, THE Submit_UI SHALL show the number of given digits (clue count)
4. THE Submit_UI SHALL provide a confirm button to proceed with submission and a cancel button to return to the input screen

### Requirement 6: Community Post Creation

**User Story:** As a puzzle creator, I want my validated puzzle to be published as a new Reddit post, so that the community can play it.

#### Acceptance Criteria

1. WHEN the Creator confirms submission, THE Puzzle_Submitter SHALL create a new Reddit custom post with the title format "Community Puzzle by u/{creator_username} ({difficulty})"
2. THE Puzzle_Submitter SHALL store the puzzle string, solution string, difficulty, Creator user ID, Creator username, and submission timestamp in Redis under the post's puzzle hash
3. THE Puzzle_Submitter SHALL store a type field with value "community" in the puzzle hash to distinguish Community_Puzzles from auto-generated puzzles
4. WHEN the post is created, THE Puzzle_Submitter SHALL return the new post URL to the Submit_UI for navigation

### Requirement 7: Creator Attribution Comment

**User Story:** As a puzzle creator, I want a comment on my puzzle post crediting me, so that solvers know who made the puzzle and I feel recognized.

#### Acceptance Criteria

1. WHEN a Community_Puzzle post is created, THE Puzzle_Submitter SHALL add a comment to the post with the text: "🧩 Community puzzle submitted by u/{creator_username}! Difficulty: {difficulty}. Think you can solve it?"
2. THE Puzzle_Submitter SHALL submit the attribution comment as the app account (not as the user)

### Requirement 8: Submission Rate Limiting

**User Story:** As a moderator, I want puzzle submissions to be rate-limited per user, so that spam and abuse are prevented.

#### Acceptance Criteria

1. WHEN a user attempts to submit a puzzle, THE Puzzle_Submitter SHALL check the time elapsed since the user's last submission
2. IF the elapsed time is less than the Submission_Cooldown of 15 minutes, THEN THE Puzzle_Submitter SHALL reject the submission with a message indicating the remaining wait time
3. WHEN a puzzle is submitted successfully, THE Puzzle_Submitter SHALL record the submission timestamp for the Creator

### Requirement 9: Community Puzzle Display Adaptation

**User Story:** As a solver, I want community puzzles to display correctly with their single difficulty and creator info, so that I have a seamless playing experience.

#### Acceptance Criteria

1. WHEN the puzzle API returns data for a Community_Puzzle, THE Submit_UI SHALL include the puzzle type, creator username, and single available difficulty in the response
2. WHILE a Community_Puzzle is loaded, THE Submit_UI SHALL display the Creator's username with a "Submitted by" label
3. WHILE a Community_Puzzle is loaded, THE Submit_UI SHALL hide the difficulty selector and display only the single available difficulty
4. THE Community_Puzzle SHALL support all existing game features: cell input, notes, hints, undo, validation, and leaderboard

### Requirement 10: Submission Input Interface

**User Story:** As a puzzle creator, I want a clear and accessible interface to paste my puzzle string, so that the submission process is straightforward.

#### Acceptance Criteria

1. THE Submit_UI SHALL provide a text input field that accepts an 81-character Puzzle_String
2. THE Submit_UI SHALL provide a submit button that initiates validation when the input is non-empty
3. WHILE validation is in progress, THE Submit_UI SHALL display a loading indicator and disable the submit button
4. IF validation fails, THEN THE Submit_UI SHALL display the error message returned by the Submission_Validator and allow the user to correct and resubmit
5. THE Submit_UI SHALL be accessible from the main game screen via a "Submit a Puzzle" button

### Requirement 11: Solve Count Tracking

**User Story:** As a puzzle creator, I want to see how many people have solved my puzzle, so that I feel motivated to submit more puzzles.

#### Acceptance Criteria

1. WHEN a user completes a Community_Puzzle, THE Puzzle_Submitter SHALL increment the Solve_Count for that puzzle in Redis
2. WHEN puzzle data is loaded for a Community_Puzzle, THE Submit_UI SHALL display the current Solve_Count
3. THE Solve_Count SHALL count each user at most once per puzzle, regardless of how many times the user completes the puzzle

### Requirement 12: Creator Submission History

**User Story:** As a puzzle creator, I want to see a list of puzzles I have submitted, so that I can track my contributions and see how they are performing.

#### Acceptance Criteria

1. WHEN a Community_Puzzle is submitted successfully, THE Puzzle_Submitter SHALL add the post ID to the Creator's submission list in Redis
2. THE Submit_UI SHALL provide a "My Puzzles" section accessible from the submission screen
3. WHEN the "My Puzzles" section is viewed, THE Submit_UI SHALL display each submitted puzzle's difficulty, submission date, and Solve_Count
