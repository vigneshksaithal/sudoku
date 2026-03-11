# Requirements Document

## Introduction

This feature splits the Sudoku app into two Devvit entrypoints: a lightweight inline preview screen for difficulty selection, and an expanded mode screen for the actual game. When a user taps a difficulty button on the inline preview, the app transitions to expanded mode (full screen on mobile, modal on web) with the selected difficulty, where the Sudoku game loads and plays.

## Glossary

- **Preview_Screen**: The inline entrypoint UI that displays difficulty selection buttons inside the Reddit post. Lightweight, fast-loading.
- **Game_Screen**: The expanded entrypoint UI that displays the full Sudoku game (board, number pad, notes, validation). Runs in expanded mode (full screen on mobile, modal on web).
- **Inline_Mode**: The default Devvit web view mode where content renders directly inside a Reddit post.
- **Expanded_Mode**: A Devvit web view mode triggered by `requestExpandedMode()` that renders content full screen on mobile or as a modal on web.
- **Difficulty**: One of four puzzle difficulty levels: simple, easy, intermediate, expert.
- **Entrypoint**: A named entry in `devvit.json` under `post.entrypoints`, each pointing to its own HTML file.

## Requirements

### Requirement 1: Dual Entrypoint Configuration

**User Story:** As a developer, I want the app to define two separate entrypoints in devvit.json, so that the inline preview and expanded game load independently with minimal bundle size.

#### Acceptance Criteria

1. THE Devvit_Configuration SHALL define a "default" entrypoint with `inline: true` pointing to the preview HTML file.
2. THE Devvit_Configuration SHALL define a "game" entrypoint pointing to the game HTML file.
3. THE Devvit_Configuration SHALL keep both entrypoints under the same `post.dir` output directory.

### Requirement 2: Preview Screen (Inline Mode)

**User Story:** As a Reddit user, I want to see a simple difficulty picker inside the post, so that I can choose a difficulty without leaving the feed.

#### Acceptance Criteria

1. WHEN the inline post loads, THE Preview_Screen SHALL display four difficulty buttons: simple, easy, intermediate, and expert.
2. WHEN the inline post loads, THE Preview_Screen SHALL display a title identifying the post as a Sudoku game.
3. THE Preview_Screen SHALL render without fetching puzzle data from the server, to minimize load time.
4. WHEN a difficulty button is tapped, THE Preview_Screen SHALL store the selected difficulty in localStorage.
5. WHEN a difficulty button is tapped, THE Preview_Screen SHALL call `requestExpandedMode(event, 'game')` to transition to the Game_Screen.

### Requirement 3: Game Screen (Expanded Mode)

**User Story:** As a Reddit user, I want the full Sudoku game to open in expanded mode after I pick a difficulty, so that I have more screen space to play.

#### Acceptance Criteria

1. WHEN the Game_Screen loads, THE Game_Screen SHALL read the selected difficulty from localStorage.
2. WHEN the Game_Screen loads with a valid difficulty, THE Game_Screen SHALL fetch the puzzle for that difficulty from the server and start the game.
3. IF no difficulty is found in localStorage, THEN THE Game_Screen SHALL default to "simple" difficulty.
4. THE Game_Screen SHALL display the Sudoku board, number pad, notes toggle, and validation feedback identical to the current playing screen.
5. WHEN the puzzle is solved, THE Game_Screen SHALL display the completion screen with the solved difficulty name.
6. WHEN the user taps "Try another difficulty" on the completion screen, THE Game_Screen SHALL clear the stored difficulty from localStorage and return to the inline Preview_Screen.

### Requirement 4: Difficulty Passing Between Entrypoints

**User Story:** As a developer, I want a reliable way to pass the selected difficulty from the preview to the game entrypoint, so that the correct puzzle loads in expanded mode.

#### Acceptance Criteria

1. THE Preview_Screen SHALL write the difficulty value to localStorage under a consistent key before requesting expanded mode.
2. THE Game_Screen SHALL read the difficulty value from localStorage using the same key on load.
3. WHEN the Game_Screen reads the difficulty, THE Game_Screen SHALL validate that the value is one of the four valid difficulties (simple, easy, intermediate, expert).
4. IF the stored difficulty value is invalid, THEN THE Game_Screen SHALL default to "simple" difficulty.

### Requirement 5: Build Configuration for Multiple Entrypoints

**User Story:** As a developer, I want Vite to produce separate bundles for each entrypoint, so that the preview stays lightweight and the game bundle loads only when needed.

#### Acceptance Criteria

1. THE Build_Configuration SHALL produce two separate HTML output files, one for the preview entrypoint and one for the game entrypoint.
2. THE Build_Configuration SHALL use Vite multi-page app configuration with separate entry HTML files.
3. THE Build_Configuration SHALL output both entrypoints to the same `dist/client` directory.

### Requirement 6: Preview Screen Styling

**User Story:** As a Reddit user, I want the inline preview to look polished and match the app's visual style, so that the post feels cohesive in my feed.

#### Acceptance Criteria

1. THE Preview_Screen SHALL use the same color scheme and font styling as the existing Game_Screen (Tailwind CSS, blue-600 buttons, neutral backgrounds).
2. THE Preview_Screen SHALL support both light and dark mode via Tailwind's dark variant.
3. THE Preview_Screen SHALL render difficulty buttons with a minimum touch target of 44x44 pixels for accessibility.
