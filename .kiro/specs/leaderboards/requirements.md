# Requirements Document

## Introduction

Add leaderboards to the Sudoku game so players can see how they rank against others. Each post has its own per-difficulty leaderboard, and a global subreddit-wide leaderboard tracks each user's best performance per difficulty. Ranking uses an adjusted time formula that penalizes hint usage, while mistakes are tracked and displayed but do not affect rank.

## Glossary

- **Leaderboard_Service**: The server-side module responsible for recording solves, computing rankings, and returning leaderboard data via API routes.
- **Solve_Record**: A hash stored in Redis containing a user's completion data for a specific puzzle and difficulty: completion time, hints used, mistakes count, adjusted time, and username.
- **Adjusted_Time**: The ranking metric calculated as `completion_time_seconds + (hints_used × 30)`. Lower values rank higher.
- **Per_Post_Leaderboard**: A sorted set in Redis that ranks users who solved a specific post's puzzle at a specific difficulty, keyed by `leaderboard:{postId}:{difficulty}`.
- **Global_Leaderboard**: A sorted set in Redis that tracks each user's single best adjusted time per difficulty across all posts in the subreddit, keyed by `leaderboard:global:{difficulty}`.
- **Completion_Screen**: The UI displayed after a user successfully solves a puzzle, showing their result and leaderboard standings.
- **Leaderboard_Panel**: A UI component accessible during gameplay via a tab or button that displays leaderboard rankings.
- **Mistakes_Count**: The number of times a user placed a digit that does not match the known solution during a solve attempt.

## Requirements

### Requirement 1: Record a Solve

**User Story:** As a player, I want my solve to be recorded when I complete a puzzle, so that I appear on the leaderboard.

#### Acceptance Criteria

1. WHEN a user submits a correct board for a given difficulty, THE Leaderboard_Service SHALL create a Solve_Record containing the user's username, completion time in seconds, hints used count, Mistakes_Count, and Adjusted_Time.
2. WHEN a user submits a correct board, THE Leaderboard_Service SHALL add the user's Adjusted_Time as the score in the Per_Post_Leaderboard sorted set for that post and difficulty.
3. WHEN a user submits a correct board AND the user's Adjusted_Time is lower than their existing score in the Global_Leaderboard for that difficulty, THE Leaderboard_Service SHALL update the Global_Leaderboard entry with the new Adjusted_Time.
4. WHEN a user submits a correct board AND the user has no existing entry in the Global_Leaderboard for that difficulty, THE Leaderboard_Service SHALL add the user's Adjusted_Time to the Global_Leaderboard for that difficulty.
5. WHEN a user has already recorded a Solve_Record for a given post and difficulty, THE Leaderboard_Service SHALL reject the submission and preserve the original Solve_Record.
6. WHEN a user submits a correct board, THE Leaderboard_Service SHALL compute Adjusted_Time as `completion_time_seconds + (hints_used × 30)`.
7. IF the user is not logged in, THEN THE Leaderboard_Service SHALL reject the solve submission with an appropriate error message.
8. IF the completion time, hints used, or Mistakes_Count values are not valid non-negative integers, THEN THE Leaderboard_Service SHALL reject the submission with a validation error.

### Requirement 2: Per-Post Leaderboard Retrieval

**User Story:** As a player, I want to see how I rank against others on the same puzzle, so that I can compare my performance on a specific post.

#### Acceptance Criteria

1. WHEN a user requests the Per_Post_Leaderboard for a given difficulty, THE Leaderboard_Service SHALL return the top 10 entries ordered by Adjusted_Time ascending (lowest first).
2. WHEN a user requests the Per_Post_Leaderboard AND the user has a Solve_Record for that post and difficulty AND the user is not in the top 10, THE Leaderboard_Service SHALL include the user's own entry with their rank appended after the top 10.
3. THE Leaderboard_Service SHALL return each leaderboard entry containing: rank, username, completion time in seconds, hints used count, and Mistakes_Count.
4. WHEN a user requests the Per_Post_Leaderboard AND no solves exist for that post and difficulty, THE Leaderboard_Service SHALL return an empty entries array.

### Requirement 3: Global Leaderboard Retrieval

**User Story:** As a player, I want to see the best solvers across all posts for each difficulty, so that I can track long-term competition.

#### Acceptance Criteria

1. WHEN a user requests the Global_Leaderboard for a given difficulty, THE Leaderboard_Service SHALL return the top 10 entries ordered by Adjusted_Time ascending (lowest first).
2. WHEN a user requests the Global_Leaderboard AND the user has an entry for that difficulty AND the user is not in the top 10, THE Leaderboard_Service SHALL include the user's own entry with their rank appended after the top 10.
3. THE Leaderboard_Service SHALL return each Global_Leaderboard entry containing: rank, username, Adjusted_Time, hints used count, and Mistakes_Count.
4. WHEN a user requests the Global_Leaderboard AND no entries exist for that difficulty, THE Leaderboard_Service SHALL return an empty entries array.

### Requirement 4: Mistakes Tracking

**User Story:** As a player, I want my mistakes to be tracked during gameplay, so that the leaderboard can display how cleanly I solved the puzzle.

#### Acceptance Criteria

1. WHEN a user places a digit in a cell AND the digit does not match the corresponding cell in the known solution for the current difficulty, THE Client SHALL increment the Mistakes_Count by one.
2. THE Client SHALL track Mistakes_Count as a non-negative integer starting at zero for each new puzzle attempt.
3. WHEN a user completes a puzzle, THE Client SHALL include the Mistakes_Count in the solve submission to the Leaderboard_Service.
4. THE Leaderboard_Service SHALL store the Mistakes_Count in the Solve_Record but SHALL NOT include Mistakes_Count in the Adjusted_Time calculation.

### Requirement 5: Leaderboard Display During Gameplay

**User Story:** As a player, I want to view the leaderboard while playing, so that I can see what times I need to beat.

#### Acceptance Criteria

1. WHILE the game screen is "playing", THE Leaderboard_Panel SHALL be accessible via a tab or button in the game UI.
2. WHEN the user opens the Leaderboard_Panel, THE Leaderboard_Panel SHALL display the Per_Post_Leaderboard for the currently selected difficulty by default.
3. WHEN the user opens the Leaderboard_Panel, THE Leaderboard_Panel SHALL provide a toggle to switch between Per_Post_Leaderboard and Global_Leaderboard views.
4. WHILE the Leaderboard_Panel is open, THE game timer SHALL continue running without interruption.

### Requirement 6: Leaderboard Display on Completion Screen

**User Story:** As a player, I want to see the leaderboard prominently after solving a puzzle, so that I can immediately see where I placed.

#### Acceptance Criteria

1. WHEN the game screen transitions to "completed", THE Completion_Screen SHALL display the Per_Post_Leaderboard for the completed difficulty.
2. WHEN the Completion_Screen is displayed AND the user has a Solve_Record, THE Completion_Screen SHALL highlight the user's own entry in the leaderboard.
3. WHEN the Completion_Screen is displayed, THE Completion_Screen SHALL show the user's completion time, hints used, Mistakes_Count, and rank.
4. WHEN the Completion_Screen is displayed, THE Completion_Screen SHALL provide a toggle to switch between Per_Post_Leaderboard and Global_Leaderboard views.

### Requirement 7: Zero-Hint Solve Indicator

**User Story:** As a player, I want a visual badge for solving without hints, so that hint-free solves are recognized.

#### Acceptance Criteria

1. WHEN a leaderboard entry has a hints used count of zero, THE Leaderboard_Panel SHALL display a visual indicator (star or badge icon) next to that entry.
2. THE Leaderboard_Panel SHALL display the zero-hint indicator consistently across Per_Post_Leaderboard and Global_Leaderboard views.
3. THE Leaderboard_Panel SHALL display the zero-hint indicator consistently across the Leaderboard_Panel and the Completion_Screen.

### Requirement 8: Solve Submission API

**User Story:** As a developer, I want a well-defined API endpoint for recording solves, so that the client can submit completion data reliably.

#### Acceptance Criteria

1. THE Leaderboard_Service SHALL expose a `POST /api/solve` endpoint that accepts a JSON body with fields: `difficulty` (string), `completionTime` (number), `hintsUsed` (number), and `mistakesCount` (number).
2. WHEN the `POST /api/solve` endpoint receives a valid request, THE Leaderboard_Service SHALL validate the board solution server-side before recording the solve.
3. WHEN the `POST /api/solve` endpoint receives a valid request, THE Leaderboard_Service SHALL derive the user identity from `context.userId` and username from `reddit.getCurrentUsername()`.
4. IF the `POST /api/solve` endpoint receives a request with an invalid difficulty value, THEN THE Leaderboard_Service SHALL return a 400 status with an error message.
5. IF the `POST /api/solve` endpoint receives a request with a non-integer or negative `completionTime`, `hintsUsed`, or `mistakesCount`, THEN THE Leaderboard_Service SHALL return a 400 status with a validation error.
6. WHEN the `POST /api/solve` endpoint records a solve successfully, THE Leaderboard_Service SHALL return the user's rank in the Per_Post_Leaderboard and the user's rank in the Global_Leaderboard for that difficulty.

### Requirement 9: Leaderboard Retrieval API

**User Story:** As a developer, I want well-defined API endpoints for fetching leaderboard data, so that the client can display rankings.

#### Acceptance Criteria

1. THE Leaderboard_Service SHALL expose a `GET /api/leaderboard/post` endpoint that accepts query parameters `difficulty` (string) and returns the Per_Post_Leaderboard for the current post.
2. THE Leaderboard_Service SHALL expose a `GET /api/leaderboard/global` endpoint that accepts query parameter `difficulty` (string) and returns the Global_Leaderboard.
3. WHEN either leaderboard endpoint is called with a logged-in user, THE Leaderboard_Service SHALL include the requesting user's entry and rank if the user is not in the top 10.
4. IF either leaderboard endpoint receives an invalid difficulty parameter, THEN THE Leaderboard_Service SHALL return a 400 status with an error message.
5. THE Leaderboard_Service SHALL use the `cache()` helper with a short TTL for leaderboard reads to reduce Redis load under concurrent access.

### Requirement 10: Redis Data Schema for Leaderboards

**User Story:** As a developer, I want a well-structured Redis schema for leaderboard data, so that rankings are stored efficiently and consistently.

#### Acceptance Criteria

1. THE Leaderboard_Service SHALL store Per_Post_Leaderboard rankings in a Redis sorted set with key `leaderboard:{postId}:{difficulty}` where the member is the userId and the score is the Adjusted_Time.
2. THE Leaderboard_Service SHALL store Global_Leaderboard rankings in a Redis sorted set with key `leaderboard:global:{difficulty}` where the member is the userId and the score is the Adjusted_Time.
3. THE Leaderboard_Service SHALL store each Solve_Record in a Redis hash with key `solve:{postId}:{difficulty}:{userId}` containing fields: `username`, `completionTime`, `hintsUsed`, `mistakesCount`, and `adjustedTime`.
4. THE Leaderboard_Service SHALL check for the existence of the Solve_Record hash key before writing to prevent duplicate solves for the same user, post, and difficulty combination.
5. FOR ALL Solve_Records written to Redis, reading the Solve_Record back and parsing its fields SHALL produce values equivalent to the original submission (round-trip property).
