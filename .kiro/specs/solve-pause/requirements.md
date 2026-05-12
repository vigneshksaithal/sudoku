# Requirements Document

## Introduction

This document defines the requirements for the Solve Pause feature in the Sudoku application. The feature adds a user-initiated Pause control to the game header that freezes the solve timer and blurs the puzzle board so the player can step away without losing their spot. A user-initiated pause keeps the solve ranked. In parallel, any passive backgrounding of the Reddit webview (tab switch, scroll-past, OS app switch) while a solve is in progress silently flags the solve as unranked and freezes the timer until the webview is foregrounded again. Both paths are unified through a single `unranked` flag on the submitted solve record, which is persisted alongside existing fields (e.g., `notesUsed`) and used by the server to decide whether the solve participates in ranked leaderboard sorted sets. The feature applies uniformly to standard puzzle rounds and community puzzle rounds.

## Glossary

- **App_Controller**: The root Svelte component (`App.svelte`) that owns round state including `elapsedSeconds`, `timerInterval`, `startTimer`, `resetRoundState`, `checkCompletion`, and `handleScoreComment`.
- **Screen_State**: The `screen` reactive value in App_Controller with values `"playing"`, `"completed"`, `"submit"`, and any other existing states that gate round-level UI.
- **Pause_Button**: A new icon-only control rendered in the header row of App_Controller, adjacent to the timer display, that toggles the paused state of an active solve.
- **Pause_Overlay**: A full-coverage overlay rendered above the `Grid.svelte` board area while the user-initiated paused state is active. It applies a backdrop blur plus a semi-opaque scrim and hosts the Resume affordance.
- **Resume_Affordance**: The interactive target on the Pause_Overlay (tap-to-resume anywhere on the overlay, including a centered Resume button, and Escape keyboard shortcut) that exits the user-initiated paused state.
- **Timer_Controller**: The logical unit in App_Controller responsible for starting, stopping, and preserving the value of `elapsedSeconds` via `timerInterval`.
- **Pause_State**: The boolean reactive value `isPaused` on App_Controller that indicates whether a user-initiated pause is currently active.
- **Background_Detector**: The visibility handling logic in App_Controller that subscribes to `document.visibilitychange` and `window.pagehide` events during the component lifetime and reacts to passive backgrounding.
- **Unranked_Flag**: The boolean reactive value `unrankedDueToBackground` on App_Controller that latches to `true` when the Background_Detector observes any backgrounding event during an active solve. It is the sole contributor to the `unranked` field on the submitted solve.
- **Solve_Submission**: The POST `/api/solve` request payload sent from App_Controller to the server when a puzzle is completed.
- **Score_Comment_Submission**: The POST `/api/score/comment` request payload sent from App_Controller to the server to post a Reddit comment summarizing the solve.
- **Solve_Validator**: The pure function `validateSolveInput()` in `src/server/lib/leaderboard.ts` that validates and parses the Solve_Submission body.
- **Solve_Recorder**: The async function `recordSolve()` in `src/server/lib/leaderboard.ts` that persists solve data to Redis and updates leaderboard sorted sets.
- **Solve_Record_Parser**: The pure function `parseSolveRecord()` in `src/server/lib/leaderboard.ts` that reads a Redis hash into a `LeaderboardEntry`.
- **Leaderboard_Entry**: The data type representing a single row in the leaderboard, including timing, hints, mistakes, `notesUsed`, and (after this feature) `unranked`.
- **Leaderboard_Reader**: The function `getLeaderboard()` in `src/server/lib/leaderboard.ts` that returns ranked entries for a given scope and difficulty.
- **Leaderboard_UI**: The Svelte component (`Leaderboard.svelte`) that renders leaderboard rows.
- **Score_Comment_Formatter**: The pure function `formatScoreComment()` in `src/server/lib/score-comment.ts` that produces a markdown-formatted Reddit comment.
- **Ranked_Solve**: A solve whose `unranked === false` at the time of Solve_Recorder persistence.
- **Unranked_Solve**: A solve whose `unranked === true` at the time of Solve_Recorder persistence.
- **Ranked_Sorted_Sets**: The Redis sorted sets `leaderboard:{postId}:{difficulty}` and `leaderboard:global:{difficulty}` that back ranked leaderboard reads.
- **Round**: The span between `resetRoundState()` and the next `resetRoundState()` (or puzzle completion submission), covering exactly one puzzle attempt.

## Requirements

### Requirement 1: Pause Button Placement and Visibility

**User Story:** As a player, I want a pause control in the game header next to the timer, so that I can pause my solve without losing my place on the board.

#### Acceptance Criteria

1. WHILE Screen_State equals `"playing"` AND the puzzle is not loading AND the puzzle is not errored, THE App_Controller SHALL render the Pause_Button in the header row adjacent to the timer display within 100 ms of Screen_State entering `"playing"`.
2. WHILE Screen_State equals `"completed"` or Screen_State equals `"submit"`, THE App_Controller SHALL NOT render the Pause_Button in the DOM.
3. WHILE the puzzle is loading OR the puzzle is in an errored state, THE App_Controller SHALL render the Pause_Button with the HTML `disabled` attribute set to `true` such that activation events (click, tap, keyboard activation) produce no state change.
4. THE Pause_Button SHALL render a visible pause glyph (inline SVG or the unicode character `⏸`) and SHALL NOT render any accompanying text label, title attribute, or tooltip.
5. THE Pause_Button SHALL expose the accessible name `"Pause solve"` via `aria-label`.
6. WHEN the Pause_Button is rendered, THE App_Controller SHALL ensure it receives keyboard focus when the user reaches it via Tab navigation from the timer element.

### Requirement 2: User-Initiated Pause State

**User Story:** As a player, I want pressing the pause button to freeze my solve, so that I can step away without the timer advancing.

#### Acceptance Criteria

1. WHEN the user activates the Pause_Button while Screen_State equals `"playing"` AND Pause_State equals `false`, THE App_Controller SHALL set Pause_State to `true` within 100 ms of the activation event.
2. WHEN the user activates the Pause_Button while Screen_State is not `"playing"` OR Pause_State equals `true`, THE App_Controller SHALL leave Pause_State unchanged and produce no observable state change.
3. WHEN Pause_State transitions from `false` to `true`, THE Timer_Controller SHALL clear `timerInterval`.
4. WHEN Pause_State transitions from `false` to `true`, THE Timer_Controller SHALL preserve the current value of `elapsedSeconds` without modification.
5. WHILE Pause_State equals `true`, THE Timer_Controller SHALL NOT increment `elapsedSeconds`.
6. WHILE Pause_State equals `true`, THE App_Controller SHALL display the preserved value of `elapsedSeconds` in the header timer.
7. WHEN Pause_State transitions from `false` to `true` due to Pause_Button activation, THE App_Controller SHALL leave Unranked_Flag unchanged.

### Requirement 3: Pause Overlay

**User Story:** As a player, I want the board to be visually obscured while paused, so that I do not accidentally memorize or see the puzzle while stepping away.

#### Acceptance Criteria

1. WHILE Pause_State equals `true`, THE App_Controller SHALL render the Pause_Overlay with full coverage of the `Grid.svelte` board bounding box leaving no visible edge gaps.
2. WHILE the Pause_Overlay is rendered, THE Pause_Overlay SHALL apply the Tailwind `backdrop-blur` filter together with a semi-opaque scrim whose effective opacity is between 60% and 95% such that no puzzle cell value, given digit, note, or conflict color is legible to the user.
3. WHILE the Pause_Overlay is rendered, THE App_Controller SHALL keep the difficulty tabs and the header timer display visible and outside the blurred/scrimmed region.
4. WHILE the Pause_Overlay is rendered, THE Pause_Overlay SHALL block pointer and keyboard input from reaching any DOM element located under the overlay region.
5. THE Pause_Overlay SHALL declare `role="dialog"` AND `aria-modal="true"`, AND SHALL expose an accessible name containing the word `"paused"`.
6. WHEN Pause_State transitions from `false` to `true`, THE App_Controller SHALL move keyboard focus to the Resume_Affordance within 100 ms.
7. WHEN Pause_State transitions from `true` to `false`, THE App_Controller SHALL restore keyboard focus to the Pause_Button within 100 ms.

### Requirement 4: Resume Affordance

**User Story:** As a player, I want to resume my solve with a single tap or key press, so that I can return to the board quickly.

#### Acceptance Criteria

1. WHILE Pause_State equals `true`, WHEN the user taps or clicks anywhere on the Pause_Overlay, THE App_Controller SHALL set Pause_State to `false` within 100 ms of the event.
2. WHILE Pause_State equals `true`, WHEN the user presses the `Escape` key, THE App_Controller SHALL set Pause_State to `false` within 100 ms of the key event.
3. WHEN Pause_State transitions from `true` to `false`, THE Timer_Controller SHALL start a new `timerInterval` that increments `elapsedSeconds` by `1` every `1000` ms beginning from its preserved value without accounting for the paused duration.
4. WHEN Pause_State transitions from `true` to `false`, THE App_Controller SHALL unmount the Pause_Overlay from the DOM and re-enable pointer and keyboard input on all board and control elements.
5. WHEN Pause_State transitions from `true` to `false`, THE App_Controller SHALL move keyboard focus to the Pause_Button such that the next `Tab` or `Enter` keypress targets it.
6. IF a resume input (Pause_Overlay tap or `Escape` keypress) arrives while Pause_State equals `false`, THEN THE App_Controller SHALL leave Pause_State unchanged and produce no observable state change.

### Requirement 5: Input Suppression While Paused

**User Story:** As a player, I want board input and action buttons to be disabled while paused, so that I cannot accidentally modify the puzzle.

#### Acceptance Criteria

1. WHILE Pause_State equals `true`, THE App_Controller SHALL ignore `click`, `tap`, `pointerdown`, `pointerup`, and keyboard activation events targeted at cells of `Grid.svelte` and buttons of `NumberPad.svelte` without changing Board_State, Notes_State, or Selection_State.
2. WHILE Pause_State equals `true`, THE App_Controller SHALL render the Submit, Hint, Undo, and Auto-Candidate controls with the HTML `disabled` attribute set to `true` and a disabled visual style, such that activation events produce no state change.
3. WHILE Pause_State equals `true`, THE Resume_Affordance SHALL be the only interactive control within the board area; its activation SHALL transition Pause_State to `false`.
4. WHILE Pause_State equals `true`, THE App_Controller SHALL intercept and prevent default handling of keyboard shortcuts that would otherwise modify Board_State, Notes_State, Selection_State, Undo_Stack, or Hint_State.
5. WHILE Pause_State equals `true`, THE App_Controller SHALL preserve Board_State, Notes_State, Selection_State, Undo_Stack, Hint_State, `hintsUsed`, and `mistakesCount` unchanged.

### Requirement 6: Passive Backgrounding Detection

**User Story:** As a system operator, I want passive backgrounding of the webview to silently mark the solve as unranked, so that leaderboard integrity is preserved when a player is not actively looking at the puzzle.

#### Acceptance Criteria

1. WHEN App_Controller mounts, THE Background_Detector SHALL subscribe to the `document.visibilitychange` event.
2. WHEN App_Controller mounts, THE Background_Detector SHALL subscribe to the `window.pagehide` event.
3. WHEN App_Controller unmounts, THE Background_Detector SHALL unsubscribe the same handler references it previously registered for `document.visibilitychange` and `window.pagehide`.
4. WHEN a `visibilitychange` event fires with `document.hidden === true` AND Screen_State equals `"playing"`, THE Background_Detector SHALL clear `timerInterval` within 0 ms of the event (no grace period).
5. WHEN a `visibilitychange` event fires with `document.hidden === true` AND Screen_State equals `"playing"`, THE Background_Detector SHALL set Unranked_Flag to `true`.
6. WHEN a `pagehide` event fires AND Screen_State equals `"playing"`, THE Background_Detector SHALL clear `timerInterval` within 0 ms of the event.
7. WHEN a `pagehide` event fires AND Screen_State equals `"playing"`, THE Background_Detector SHALL set Unranked_Flag to `true`.
8. WHEN a `visibilitychange` event fires with `document.hidden === false` AND Screen_State equals `"playing"` AND Pause_State equals `false`, THE Timer_Controller SHALL start a new `timerInterval` that continues `elapsedSeconds` from its preserved value without reset.
9. WHILE Pause_State equals `false` AND Unranked_Flag transitioned to `true` solely due to a backgrounding event, THE App_Controller SHALL NOT render the Pause_Overlay.
10. IF Unranked_Flag equals `true`, THEN no subsequent `visibilitychange`, `pagehide`, Pause_Button, or Resume_Affordance event within the current Round SHALL set Unranked_Flag back to `false`.

### Requirement 7: Unified Unranked Flag Semantics

**User Story:** As a system operator, I want a single unranked flag that reflects only passive backgrounding, so that manual pausing and passive backgrounding are clearly differentiated in the submission payload.

#### Acceptance Criteria

1. WHEN a new Round begins, THE App_Controller SHALL set Unranked_Flag to `false`.
2. WHEN `resetRoundState()` runs, THE App_Controller SHALL set Unranked_Flag to `false`.
3. WHEN `resetRoundState()` runs, THE App_Controller SHALL set Pause_State to `false`.
4. WHILE a Round is in progress AND Unranked_Flag equals `true`, THE App_Controller SHALL retain Unranked_Flag as `true` until that Round ends, regardless of any foregrounding, pause, or resume event occurring during the Round.
5. WHEN Pause_Button is activated, THE App_Controller SHALL leave the current value of Unranked_Flag unchanged.
6. WHEN Resume_Affordance is activated, THE App_Controller SHALL leave the current value of Unranked_Flag unchanged.
7. WHEN a Solve_Submission is created, THE App_Controller SHALL set the `unranked` field of the Solve_Submission to the current value of Unranked_Flag.

### Requirement 8: Submission Pipeline Extension

**User Story:** As a player, I want my solve submission to carry the unranked flag end to end, so that the server can persist the correct ranked state and post the correct score comment.

#### Acceptance Criteria

1. THE Solve_Submission body SHALL include an `unranked` field of type boolean alongside the existing `difficulty`, `completionTime`, `hintsUsed`, `mistakesCount`, and `notesUsed` fields.
2. THE Score_Comment_Submission body SHALL include an `unranked` field of type boolean.
3. THE `ScoreCommentData` input type of the Score_Comment_Formatter SHALL include an `unranked` field of type boolean.
4. WHEN Score_Comment_Formatter is invoked with `unranked` equal to `true`, THE Score_Comment_Formatter SHALL include a markdown table row whose left cell is exactly `🏁 Unranked` in the generated comment output.
5. WHEN Score_Comment_Formatter is invoked with `unranked` equal to `false`, THE Score_Comment_Formatter SHALL NOT include the `🏁 Unranked` row in the generated comment output.
6. THE App_Controller SHALL include the current value of `notesUsed` in both the Solve_Submission and Score_Comment_Submission bodies unchanged by this feature.

### Requirement 9: Server Validation of Unranked Field

**User Story:** As a system operator, I want the server to validate the unranked field, so that malformed submissions are rejected consistently with existing fields.

#### Acceptance Criteria

1. WHEN a solve submission request body contains an `unranked` field whose value is strictly of JavaScript/TypeScript type `boolean` (either `true` or `false`), THE Solve_Validator SHALL accept the field and include the boolean value unchanged in its successful result object.
2. IF the `unranked` field is present in the request body but its value is not strictly of type `boolean` (including `null`, numbers, strings such as `"true"`/`"false"`, arrays, objects, or any non-boolean JSON type), THEN THE Solve_Validator SHALL reject the request and return a validation error that (a) identifies the field name `unranked`, (b) indicates the expected type as boolean, and (c) uses the same error shape and contract already used by the Solve_Validator for type-mismatch errors on other existing fields, without modifying or persisting any submission state.
3. WHEN the `unranked` field is absent from the request body (the key is not present or its value is `undefined`), THE Solve_Validator SHALL treat the field as the boolean value `false` and include `unranked: false` in its successful result object.
4. THE Solve_Validator SHALL return the resolved `unranked` boolean value as a field on its successful result object alongside all other validated fields.

### Requirement 10: Server Persistence and Ranked Sorted Set Membership

**User Story:** As a system operator, I want unranked solves stored in Redis but excluded from the ranked sorted sets, so that players can still see their time while leaderboard rankings stay clean.

#### Acceptance Criteria

1. WHEN Solve_Recorder persists a solve, THE Solve_Recorder SHALL write the `unranked` field to the Redis hash for both the post-level solve record AND the global solve record as exactly one of the literal strings `"true"` or `"false"`, rejecting any other value prior to write.
2. WHEN Solve_Recorder persists a solve with `unranked` equal to `"false"`, THE Solve_Recorder SHALL add the solve's adjusted-time score to both Ranked_Sorted_Sets in the same logical operation as the hash write such that both reflect the score before Solve_Recorder returns success.
3. WHEN Solve_Recorder persists a solve with `unranked` equal to `"true"`, THE Solve_Recorder SHALL NOT add the solve to either of the Ranked_Sorted_Sets (neither as a scored entry nor as a score-less placeholder).
4. IF the hash write fails while persisting a solve with `unranked` equal to `"false"`, THEN THE Solve_Recorder SHALL NOT leave entries for that solve in either of the Ranked_Sorted_Sets.
5. IF Solve_Recorder is invoked with an `unranked` value that is not one of `"true"` or `"false"`, THEN THE Solve_Recorder SHALL reject the operation without writing the hash or modifying either of the Ranked_Sorted_Sets.
6. THE Solve_Recorder SHALL compute the adjusted-time score using the existing `completionTime + hintsUsed × 30` formula unchanged.

### Requirement 11: Leaderboard Read Path

**User Story:** As a player, I want to see my unranked solves reflected in the leaderboard view without being mixed into ranked positions, so that I can still track my own results.

#### Acceptance Criteria

1. WHEN Solve_Record_Parser reads a Redis hash whose `unranked` field equals `"true"`, THE Solve_Record_Parser SHALL set `unranked` to `true` on the produced Leaderboard_Entry.
2. WHEN Solve_Record_Parser reads a Redis hash whose `unranked` field equals `"false"`, THE Solve_Record_Parser SHALL set `unranked` to `false` on the produced Leaderboard_Entry.
3. WHEN Solve_Record_Parser reads a Redis hash that lacks the `unranked` field OR whose `unranked` field contains any value other than `"true"` or `"false"`, THE Solve_Record_Parser SHALL set `unranked` to `false` on the produced Leaderboard_Entry without raising a validation error.
4. THE Leaderboard_Reader SHALL return up to the top 10 entries sourced from the Ranked_Sorted_Sets such that Unranked_Solves are not members of the returned entries list.
5. WHEN the requesting user's solve exists only as an Unranked_Solve hash AND the user is not present in the Ranked_Sorted_Sets, THE Leaderboard_Reader SHALL return the user's solve as a `userEntry` with the rank field set to `null`.
6. WHEN Leaderboard_UI receives a `userEntry` whose `unranked` field equals `true`, THE Leaderboard_UI SHALL render the entry below the top-N divider with no rank number displayed AND SHALL render a visible unranked badge on the entry.

### Requirement 12: Backward Compatibility for Legacy Records

**User Story:** As a system operator, I want existing solve records without the unranked field to continue working, so that deploying this feature does not require a Redis migration.

#### Acceptance Criteria

1. WHEN Solve_Record_Parser encounters a Redis hash that lacks the `unranked` key, THE Solve_Record_Parser SHALL produce a Leaderboard_Entry with `unranked` set to the boolean value `false`.
2. WHEN Solve_Record_Parser encounters a Redis hash whose `unranked` value is an empty string or any string other than `"true"` or `"false"`, THE Solve_Record_Parser SHALL produce a Leaderboard_Entry with `unranked` set to `false` without raising a validation error.
3. WHILE processing any legacy solve record, THE Solve_Record_Parser SHALL NOT fail, throw, or return a validation error due to the absent or unrecognized `unranked` value.
4. THE feature SHALL NOT perform any offline rewrite, migration, or backfill of existing Redis keys either at deploy time or at runtime.
5. WHEN Leaderboard_Reader returns a legacy solve record (pre-feature) and a new solve record explicitly written with `unranked === false`, THE Leaderboard_Reader SHALL rank both identically using their adjusted-time scores.

### Requirement 13: Community Puzzle Parity

**User Story:** As a community puzzle player, I want pause and backgrounding to work identically to standard puzzles, so that behavior is predictable regardless of puzzle source.

#### Acceptance Criteria

1. WHILE the current puzzle has `puzzleType === 'community'`, THE App_Controller SHALL apply the Pause_Button, Pause_Overlay, Resume_Affordance, Pause_State, and Unranked_Flag state-transition rules identically to standard puzzles, with no community-specific branches in control flow.
2. WHILE the current puzzle has `puzzleType === 'community'`, THE Background_Detector SHALL set Unranked_Flag to `true` on backgrounding events (tab hidden, window blur, OS app suspension) using the same logic used for standard puzzles.
3. WHEN a Solve_Submission is created for a community puzzle, THE App_Controller SHALL include the `unranked` field using the same field name, boolean type, and semantics as for standard puzzles.
4. WHEN a Score_Comment_Submission is created for a community puzzle, THE App_Controller SHALL include the `unranked` field using the same field name, boolean type, and semantics as for standard puzzles.
5. WHILE Unranked_Flag equals `true` during a community puzzle Round, THE App_Controller SHALL retain Unranked_Flag as `true` across subsequent pause, resume, and foregrounding events until the Round ends.

### Requirement 14: Round Reset

**User Story:** As a player, I want every new puzzle round to start in a clean paused and ranked state, so that prior round behavior does not leak across puzzles.

#### Acceptance Criteria

1. WHEN `resetRoundState()` runs, THE App_Controller SHALL set Pause_State to `false`.
2. WHEN `resetRoundState()` runs, THE App_Controller SHALL set Unranked_Flag to `false`.
3. WHEN `resetRoundState()` runs, THE App_Controller SHALL keep the Background_Detector subscribed to its existing `document.visibilitychange` and `window.pagehide` listeners without re-subscribing.
4. WHEN `resetRoundState()` runs, THE Timer_Controller SHALL reset `elapsedSeconds` to `0`.
5. WHEN `resetRoundState()` runs, THE Timer_Controller SHALL start a fresh `timerInterval` that increments `elapsedSeconds` by `1` every `1000` ms.
6. WHEN `resetRoundState()` runs, THE App_Controller SHALL unmount the Pause_Overlay if it was rendered.

### Requirement 15: Correctness Properties for Property-Based Testing

**User Story:** As a system operator, I want property-based tests that guard the unranked flag across persistence and latching, so that regressions in the ranked/unranked contract are caught automatically.

#### Acceptance Criteria

1. WHEN a property-based test runs with at least 100 randomly generated solves, each containing a userId, postId, difficulty, `completionTime`, `hintsUsed`, `mistakesCount`, `notesUsed`, and a boolean `unranked` value, THE system under test SHALL produce a Leaderboard_Entry via `recordSolve` followed by `parseSolveRecord` whose `unranked` field equals the original input `unranked` value for every sample (round-trip property).
2. WHEN a property-based test runs with at least 100 randomly generated solves persisted via `recordSolve`, THE system under test SHALL satisfy: a solve is a member of the Ranked_Sorted_Sets for its `{postId, difficulty}` scope if and only if the `unranked` value passed to `recordSolve` equals `false` (ranked-membership property).
3. WHEN a property-based test runs with at least 100 randomly generated event sequences of length between 1 and 50 per Round, each containing at least one backgrounding event, THE App_Controller SHALL keep Unranked_Flag equal to `true` for every event following the first backgrounding event in the sequence until the next `resetRoundState()` (latch property).
