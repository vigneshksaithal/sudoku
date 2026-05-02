# Requirements Document

## Introduction

This feature covers two related improvements to the Sudoku application:

1. **Candidate Font Size Increase** — Enlarge the pencil mark (candidate/notes) font size in the sudoku grid for better readability on both mobile and desktop screens.

2. **"Notes Used" Leaderboard Column** — Track whether a player used any notes/candidates during their solve, persist this flag through the solve submission pipeline, display it as a new column in the leaderboard, and include it in the Reddit score comment.

## Glossary

- **Grid**: The Svelte component (`Grid.svelte`) that renders the 9×9 sudoku board, including candidate digits in empty cells.
- **Candidate_Digit**: A pencil mark digit (1–9) displayed in a 3×3 inner grid within an empty cell, indicating possible values.
- **Notes_Tracker**: The client-side boolean flag (`notesUsed`) in `App.svelte` that records whether the player performed any note-related action during the current solve.
- **Solve_Submission**: The POST `/api/solve` request payload sent from the client to the server upon puzzle completion.
- **Score_Comment_Formatter**: The pure function `formatScoreComment()` in `score-comment.ts` that produces a markdown-formatted Reddit comment from solve statistics.
- **Leaderboard_Entry**: The data type representing a single row in the leaderboard, containing rank, username, timing, hints, mistakes, adjusted time, and notes-used status.
- **Solve_Validator**: The pure function `validateSolveInput()` in `leaderboard.ts` that validates and parses the solve submission request body.
- **Solve_Recorder**: The async function `recordSolve()` in `leaderboard.ts` that persists solve data to Redis and computes rankings.
- **Solve_Record_Parser**: The pure function `parseSolveRecord()` in `leaderboard.ts` that reads a Redis hash into a `LeaderboardEntry`.
- **Leaderboard_UI**: The Svelte component (`Leaderboard.svelte`) that renders the leaderboard table.

## Requirements

### Requirement 1: Increase Candidate Digit Font Size

**User Story:** As a player, I want larger candidate digit font sizes in the grid, so that pencil marks are easier to read on both mobile and desktop screens.

#### Acceptance Criteria

1. THE Grid SHALL render Candidate_Digit elements with a base font size of `0.65rem` on viewports below the `sm` breakpoint.
2. WHILE the viewport is at or above the `sm` breakpoint, THE Grid SHALL render Candidate_Digit elements with a font size of `0.75rem`.
3. THE Grid SHALL preserve the existing `p-px` padding on the 3×3 candidate inner grid without modification.
4. THE Grid SHALL preserve the existing `leading-none` line-height on Candidate_Digit elements without modification.

### Requirement 2: Track Notes Usage on the Client

**User Story:** As a player, I want the game to automatically detect when I use notes, so that my notes usage is accurately reported on the leaderboard.

#### Acceptance Criteria

1. THE Notes_Tracker SHALL initialize to `false` at the start of each new puzzle round.
2. WHEN the player toggles a note manually via the `toggleNote` function, THE Notes_Tracker SHALL set its value to `true`.
3. WHEN the player activates the Auto Candidate feature, THE Notes_Tracker SHALL set its value to `true`.
4. WHEN the player toggles notes via multi-selection (applyAutoNotes), THE Notes_Tracker SHALL set its value to `true`.
5. WHEN the Notes_Tracker value is already `true`, THE Notes_Tracker SHALL remain `true` for the remainder of the current puzzle round regardless of subsequent actions.

### Requirement 3: Include Notes Usage in Solve Submission

**User Story:** As a player, I want my notes usage to be submitted with my solve, so that it appears on the leaderboard.

#### Acceptance Criteria

1. THE Solve_Submission SHALL include a `notesUsed` field of type boolean in the request body alongside `difficulty`, `completionTime`, `hintsUsed`, and `mistakesCount`.
2. THE Solve_Validator SHALL accept a `notesUsed` field that is a boolean value.
3. IF the `notesUsed` field is not a boolean, THEN THE Solve_Validator SHALL return a descriptive error string.
4. THE Solve_Validator SHALL return the parsed `notesUsed` value as part of its successful result object.

### Requirement 4: Persist Notes Usage in Redis

**User Story:** As a system operator, I want notes usage stored in Redis solve records, so that the leaderboard can display it.

#### Acceptance Criteria

1. THE Solve_Recorder SHALL store the `notesUsed` value as a string (`"true"` or `"false"`) in the Redis hash for both post-level (`solve:{postId}:{difficulty}:{userId}`) and global-level (`solve:global:{difficulty}:{userId}`) solve records.
2. THE Solve_Record_Parser SHALL read the `notesUsed` field from the Redis hash and convert it to a boolean on the Leaderboard_Entry.
3. WHEN the `notesUsed` field is missing from a Redis hash (legacy records), THE Solve_Record_Parser SHALL set `notesUsed` to `undefined` on the Leaderboard_Entry.

### Requirement 5: Display Notes Column in Leaderboard

**User Story:** As a player, I want to see whether each solver used notes, so that I can compare solve strategies on the leaderboard.

#### Acceptance Criteria

1. THE Leaderboard_UI SHALL display columns in the order: `#`, `Player`, `Time`, `Hints`, `Err`, `Notes`, `Score`.
2. WHEN a Leaderboard_Entry has `notesUsed` equal to `true`, THE Leaderboard_UI SHALL display "Yes" in the Notes column for that entry.
3. WHEN a Leaderboard_Entry has `notesUsed` equal to `false`, THE Leaderboard_UI SHALL display "No" in the Notes column for that entry.
4. WHEN a Leaderboard_Entry has `notesUsed` equal to `undefined` (legacy record), THE Leaderboard_UI SHALL display "-" (dash) in the Notes column for that entry.
5. THE Leaderboard_UI SHALL apply the Notes column to both the top-N entries table and the user entry row below the divider.

### Requirement 6: Include Notes Usage in Score Comment

**User Story:** As a player, I want my Reddit score comment to show whether I used notes, so that other players can see my solve approach.

#### Acceptance Criteria

1. THE Score_Comment_Formatter SHALL accept a `notesUsed` boolean field in its input data type.
2. THE Score_Comment_Formatter SHALL include a "📝 Notes" row in the markdown stats table with value "Yes" when `notesUsed` is `true` and "No" when `notesUsed` is `false`.
3. THE Solve_Submission to POST `/api/score/comment` SHALL include the `notesUsed` field in the request body.

### Requirement 7: Backward Compatibility for Leaderboard Entry Type

**User Story:** As a system operator, I want the system to handle existing solve records that lack the `notesUsed` field, so that the leaderboard remains functional during the transition.

#### Acceptance Criteria

1. THE Leaderboard_Entry type SHALL define `notesUsed` as `boolean | undefined` to accommodate legacy records.
2. THE Leaderboard_UI local type SHALL mirror the server Leaderboard_Entry type including the optional `notesUsed` field.
3. WHEN the Solve_Record_Parser encounters a Redis hash without a `notesUsed` key, THE Solve_Record_Parser SHALL produce a Leaderboard_Entry with `notesUsed` set to `undefined`.
