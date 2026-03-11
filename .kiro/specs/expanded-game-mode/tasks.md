# Implementation Plan: Expanded Game Mode

## Overview

Split the single-entrypoint Sudoku app into two Devvit entrypoints — a lightweight inline preview screen (plain HTML/JS) for difficulty selection, and an expanded mode game screen (Svelte) for the full Sudoku game. Difficulty is passed between entrypoints via localStorage. The preview is framework-free for instant load; the game screen reuses the existing Svelte app with the picking screen removed.

## Tasks

- [x] 1. Create shared constants and update types
  - [x] 1.1 Create `src/client/lib/constants.ts` with `DIFFICULTY_STORAGE_KEY` and `VALID_DIFFICULTIES`
    - Export `DIFFICULTY_STORAGE_KEY = 'sudoku-difficulty' as const`
    - Export `VALID_DIFFICULTIES: readonly Difficulty[] = ['simple', 'easy', 'intermediate', 'expert'] as const`
    - Export a `parseDifficulty(raw: string | null): Difficulty` helper that returns the validated difficulty or defaults to `'simple'`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.2 Write property tests for difficulty validation (`src/client/lib/__tests__/constants.test.ts`)
    - **Property 1: Difficulty round-trip through localStorage**
    - **Validates: Requirements 2.4, 4.1, 4.2**
    - For any valid difficulty, writing to localStorage with `DIFFICULTY_STORAGE_KEY` and reading back should return the original value
    - **Property 2: Difficulty validation accepts only valid values**
    - **Validates: Requirements 4.3, 4.4, 3.3**
    - For any arbitrary string (including empty, unicode, near-misses), `parseDifficulty` always returns one of the four valid difficulties
    - For the four valid strings, `parseDifficulty` returns the input unchanged
    - For null/undefined/invalid strings, `parseDifficulty` returns `'simple'`

  - [x] 1.3 Update `src/client/lib/types.ts` — change `GameScreen` to `'playing' | 'completed'` (drop `'picking'`)
    - _Requirements: 3.4_

- [x] 2. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Create the preview entrypoint (inline mode)
  - [x] 3.1 Create `src/client/preview/index.html`
    - Minimal HTML with `<div id="app">` and `<script type="module" src="./main.ts">`
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Create `src/client/preview/main.ts`
    - Import `DIFFICULTY_STORAGE_KEY` and `VALID_DIFFICULTIES` from `../lib/constants`
    - Import `requestExpandedMode` from `@devvit/web/client`
    - Render a title ("Sudoku") and four difficulty buttons (simple, easy, intermediate, expert)
    - On button click: `localStorage.setItem(DIFFICULTY_STORAGE_KEY, difficulty)` then `requestExpandedMode(event, 'game')`
    - Use Tailwind classes matching the existing app style (blue-600 buttons, neutral backgrounds, dark mode support)
    - Buttons must have minimum 44x44px touch targets for accessibility
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 6.1, 6.2, 6.3_

  - [x] 3.3 Write tests for preview button behavior (`src/client/preview/__tests__/main.test.ts`)
    - **Property 3: Preview button click stores difficulty before requesting expanded mode**
    - **Validates: Requirements 2.5, 4.1**
    - For each valid difficulty, simulate click, assert localStorage contains the value and `requestExpandedMode` was called with `(event, 'game')`
    - Unit test: verify four buttons are rendered with correct labels
    - Unit test: verify title is rendered

- [x] 4. Create the game entrypoint and update App.svelte
  - [x] 4.1 Create `src/client/game/index.html`
    - Minimal HTML with `<div id="app">` and `<script type="module" src="./main.ts">`
    - _Requirements: 1.2_

  - [x] 4.2 Create `src/client/game/main.ts`
    - Import `mount` from `svelte`, `../app.css`, `App` from `../App.svelte`
    - Import `DIFFICULTY_STORAGE_KEY`, `parseDifficulty` from `../lib/constants`
    - Read difficulty from localStorage using `parseDifficulty(localStorage.getItem(DIFFICULTY_STORAGE_KEY))`
    - Mount `App` with `{ target: appElement, props: { difficulty } }`
    - _Requirements: 3.1, 3.2, 3.3, 4.2, 4.3, 4.4_

  - [x] 4.3 Update `src/client/App.svelte`
    - Accept `difficulty` as a prop instead of managing it internally
    - Remove the `'picking'` screen and `selectDifficulty` function
    - Start in `'playing'` screen — call `fetchPuzzles()` on mount, then parse the board for the given difficulty
    - Replace `backToPicking` with `returnToPreview`: clear localStorage (`localStorage.removeItem(DIFFICULTY_STORAGE_KEY)`) — user dismisses the modal to return to inline post
    - Update the "← Back" button and "Try another difficulty" button to call `returnToPreview`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.4 Write tests for game mount (`src/client/game/__tests__/main.test.ts`)
    - **Property 4: Game screen fetches puzzle for stored difficulty**
    - **Validates: Requirements 3.1, 3.2**
    - For each valid difficulty, set localStorage, mount game, assert fetch was called and the correct difficulty puzzle is used
    - Unit test: verify default to `'simple'` when localStorage is empty
    - Unit test: verify default to `'simple'` when localStorage contains invalid value

- [x] 5. Update devvit.json and remove old entrypoint files
  - [x] 5.1 Update `devvit.json` to define dual entrypoints
    - Change `"default"` entrypoint entry to `"preview/index.html"` (keep `inline: true`, `height: "tall"`)
    - Add `"game"` entrypoint with entry `"game/index.html"`
    - Keep both under the same `post.dir: "dist/client"`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 5.2 Remove old `src/client/main.ts` and `src/client/index.html`
    - These are replaced by the new entrypoint-specific files
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- No server changes are needed — the existing Hono API is unchanged
- The preview screen uses plain HTML/JS (no Svelte) for minimal bundle size
- Tailwind CSS is processed by the Vite plugin for both entrypoints
