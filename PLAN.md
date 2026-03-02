# Sudoku Game — MVP Plan

## Scope

A playable Sudoku puzzle embedded in a Reddit post via Devvit. One post = three fully independent puzzles (easy, medium, hard), each with its own unique solution. Users pick a difficulty, solve the grid, and get a pass/fail on completion. No timer, no leaderboard, no progress saving, no notes — just play.

### Why independent solutions?

If three difficulties shared one solution, a player who completes Easy (46 givens) would see cells that are blank in Hard — leaking answers across difficulties. Independent generation eliminates this entirely. The cost is ~3× generation time (~150–900ms) and ~50% more storage (~500 bytes vs ~330 bytes per post), both negligible against Devvit's 30s timeout and 500MB Redis cap.

---

## Algorithm

### Generation (server-side, runs once on post creation)

```
generateSolution():
  1. Create empty 9×9 grid (all zeros)
  2. Fill the three diagonal 3×3 boxes (top-left, center, bottom-right)
     — these boxes share no rows or columns, so fill each independently
       with a shuffled [1..9]
  3. Solve the remaining cells via backtracking
  4. Return the completed 81-cell board
```

### Validation Check

```
isValid(board, row, col, num):
  1. Check row: if num exists in board[row][0..8] → return false
  2. Check col: if num exists in board[0..8][col] → return false
  3. Check 3×3 box:
     - boxRow = floor(row / 3) * 3
     - boxCol = floor(col / 3) * 3
     - if num exists in board[boxRow..boxRow+2][boxCol..boxCol+2] → return false
  4. Return true
```

This is the core constraint check used by solve(), countSolutions(), and client-side conflict detection. Same logic, shared between server (generation) and client (highlighting).

### Backtracking Solver

```
solve(board):
  1. Find first empty cell (value 0). If none → board is solved, return true
  2. For num = 1 to 9:
     a. If isValid(board, row, col, num):  // no duplicate in row, col, or 3×3 box
        - board[row][col] = num
        - If solve(board) → return true
        - board[row][col] = 0              // backtrack
  3. Return false (no valid number fits → triggers backtrack in caller)
```

### Punching Holes (creating the puzzle from the solution)

```
punchHoles(solution, cellsToRemove):
  1. Clone the solution
  2. Create a shuffled list of all 81 cell positions
  3. removed = 0
  4. For each position in the shuffled list:
     a. Save the cell's current value
     b. Set cell to 0
     c. Run countSolutions(board) — a solver variant that stops at 2
     d. If solutions == 1 → keep the removal, removed++
     e. If solutions > 1 → restore the saved value (removal breaks uniqueness)
     f. If removed == cellsToRemove → stop
  5. Return the punched board
```

### Counting Solver (uniqueness guarantee)

```
countSolutions(board, limit = 2):
  1. Find first empty cell. If none → return 1 (found a complete solution)
  2. count = 0
  3. For num = 1 to 9:
     a. If isValid(board, row, col, num):
        - board[row][col] = num
        - count += countSolutions(board, limit)
        - board[row][col] = 0
        - If count >= limit → return count (early bail — we only care "is it unique?")
  4. Return count
```

### Difficulty Levels

| Difficulty | Cells removed | Givens remaining |
|-----------|--------------|-----------------|
| Easy       | 35            | 46               |
| Medium     | 45            | 36               |
| Hard       | 54            | 27               |

Each difficulty gets its own independent generation run (generateSolution → punchHoles). Three separate solutions, three separate puzzles. No info leakage across difficulties.

### Performance

- Generation + 3 independent difficulty runs with uniqueness checks: ~150–900ms in JS for 9×9
- Well within Devvit's 30-second server timeout
- If removal gets stuck (can't reach target count without breaking uniqueness), accept what we have — the puzzle is still valid, just slightly easier than intended

---

## Redis Schema

One hash per post. Boards stored as 81-character strings (digits 0–9, where 0 = blank). Each difficulty has its own independent solution.

```
Key:    puzzle:{postId}
Type:   Hash

Fields:
  easy:solution      "534678912672195348198342567..."   # 81 chars
  easy:puzzle        "530070000600195000098000060..."   # 81 chars
  medium:solution    "271459386845362179963817254..."   # 81 chars
  medium:puzzle      "200050000800300100060000050..."   # 81 chars
  hard:solution      "896215347312748965754963128..."   # 81 chars
  hard:puzzle        "800000000000700900000060000..."   # 81 chars
  createdAt          "1740902400000"                    # Date.now() at post creation
```

Storage per post: 6 fields × 81 chars + timestamp ≈ 510 bytes.
At 500MB Redis cap: supports ~1 million posts per subreddit.
createdAt costs nothing now, useful later for expiry or analytics.

### Encoding/Decoding

```
Board (9×9 number[][]) → String:  board.flat().join("")
String → Board:  str.split("").map(Number) → chunk into 9 rows of 9
```

---

## API Routes

### POST /internal/menu/post-create
Trigger: mod clicks "Create Sudoku" menu item.
1. For each difficulty (easy, medium, hard):
   a. Generate independent solution
   b. Punch holes for that difficulty
2. `redis.hSet("puzzle:{postId}", { "easy:solution": ..., "easy:puzzle": ..., "medium:solution": ..., "medium:puzzle": ..., "hard:solution": ..., "hard:puzzle": ... })`
3. `reddit.submitCustomPost(...)` with title "Sudoku Challenge"
4. Return `{ navigateTo: postUrl }`

### GET /api/puzzle
Trigger: client loads the post.
1. Read `postId` from Devvit context
2. `redis.hMGet("puzzle:{postId}", ["easy:puzzle", "medium:puzzle", "hard:puzzle"])`
3. Return `{ easy, medium, hard }` — omit solutions

### POST /api/validate
Trigger: user submits completed board.
Body: `{ board: string, difficulty: "easy" | "medium" | "hard" }`
1. Read solution from `redis.hGet("puzzle:{postId}", "{difficulty}:solution")`
2. Compare `board === solution`
3. Return `{ valid: true }` or `{ valid: false }`

---

## Client Architecture

### Screens (states in App.svelte)

```
DifficultyPicker → Game → Completion
```

1. **DifficultyPicker**: three buttons (Easy, Medium, Hard). Fetches puzzle on mount.
2. **Game**: 9×9 grid + number pad. All logic client-side.
3. **Completion**: "Puzzle solved!" message with option to try another difficulty.

### Components

```
App.svelte              — state machine: "picking" | "playing" | "completed"
  Grid.svelte           — 9×9 board, handles cell selection
  NumberPad.svelte      — buttons 1–9 + erase
```

### Client-Side Game Logic (in lib/sudoku-utils.ts)

- **Cell selection**: tap a cell to select it, tap a number to place it
- **Locked cells**: original givens (non-zero in puzzle) are not editable, visually distinct
- **Conflict detection**: when a number is placed, scan its row, column, and 3×3 box for duplicates. Highlight conflicts in red. This is instant, no server call.
- **Completion check**: after each placement, check if all 81 cells are non-zero and no conflicts exist. If so, POST /api/validate for server-side confirmation.

### UI Constraints

- Post height: "tall" (512px in Devvit)
- Mobile-first: majority of Reddit users are on mobile
- Tap-only input: no drag, no scroll hijacking
- Grid cells: minimum 36×36px for touch targets → 324px grid width, fits mobile
- Color scheme: respect light/dark mode via Tailwind

---

## File Structure

```
src/
├── server/
│   ├── index.ts                # Hono routes: /api/puzzle, /api/validate
│   ├── post.ts                 # createPost(): generate puzzle → Redis → submit post
│   └── lib/
│       └── sudoku.ts           # generateSolution, solve, punchHoles, countSolutions, isValid
├── client/
│   ├── App.svelte              # Root: screen state machine
│   ├── app.css                 # Tailwind import (existing)
│   ├── main.ts                 # Mount (existing)
│   ├── index.html              # Entry (existing)
│   ├── components/
│   │   ├── Grid.svelte         # 9×9 grid with cell selection + conflict highlighting
│   │   └── NumberPad.svelte    # 1–9 buttons + erase
│   └── lib/
│       ├── sudoku-utils.ts     # hasConflict, isComplete, parseBoard, boardToString
│       └── types.ts            # Difficulty, CellState, GameScreen
└── shared/
    └── tsconfig.json           # (existing, no source files needed for MVP)
```

---

## What's Explicitly Out of MVP

| Feature             | Why cut                                      | Ship in |
|---------------------|----------------------------------------------|---------|
| Timer               | No leaderboard → no reason to time            | v2      |
| Leaderboard         | Extra sorted sets, routes, UI                  | v2      |
| Notes / pencil marks| Significant UI complexity (multi-value cells)  | v2      |
| Undo / redo         | Move history stack, extra UI                   | v2      |
| Progress saving     | No localStorage, no Redis progress keys        | v2      |
| Anti-cheat          | No leaderboard → nothing to cheat on           | v2      |
| Difficulty by technique | Cell count is good enough for MVP           | v3      |

---

## Build Order

1. `src/server/lib/sudoku.ts` — pure generation engine, zero dependencies
2. `src/server/post.ts` — wire generation into post creation, store in Redis
3. `src/server/index.ts` — add /api/puzzle and /api/validate routes
4. `src/client/lib/types.ts` — shared client types
5. `src/client/lib/sudoku-utils.ts` — conflict detection, completion check
6. `src/client/components/Grid.svelte` — the board
7. `src/client/components/NumberPad.svelte` — number input
8. `src/client/App.svelte` — wire everything together
9. Type-check: `bun run type-check`
