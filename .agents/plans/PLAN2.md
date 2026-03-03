# QQWing-Style Puzzle Engine — Plan

## Goal

Replace the current brute-force generation/validation with a QQWing-style candidate-elimination solver. This gives us technique-based difficulty grading, a foundation for hints, and better puzzle quality — all within Devvit's 30s execution limit.

## What changes from PLAN.md

| Aspect | PLAN.md (current) | This plan |
|--------|-------------------|-----------|
| Solution generation | Fill diagonal boxes → backtrack rest | Randomized full-board solve via candidate elimination + backtracking fallback |
| Uniqueness check | `countSolutions` brute-force (try all 1-9 per cell) | Logic solver first, backtrack fallback — same correctness, faster in practice |
| Difficulty grading | Cell removal count (35/45/54) | Technique-based: which solving techniques does the puzzle require? |
| Difficulty levels | easy / medium / hard | simple / easy / intermediate / expert (matches QQWing) |
| Solver | None (just backtracking) | Full candidate-tracking solver with 6 technique families |
| Symmetry | None | Optional symmetric clue removal (rotate180, mirror, etc.) |
| Hint support | None | Solver log provides per-step explanations (future, not in this plan) |

What does NOT change: Redis schema shape, API routes, client components, Svelte UI, file structure conventions. The solver is a drop-in replacement for `src/server/lib/sudoku.ts`.

---

## Core Data Structure

Two flat arrays instead of a 9×9 grid:

```
solution[81]        — value placed in each cell (0 = unsolved)
possibilities[729]  — 81 cells × 9 values; 0 = still possible, non-zero = round eliminated
```

Index math:
- `possibilityIndex(valueIndex, cell) = valueIndex + (9 * cell)`
- `cellToRow(cell) = floor(cell / 9)`
- `cellToCol(cell) = cell % 9`
- `cellToBox(cell) = floor(row / 3) * 3 + floor(col / 3)`

The round number stored in `possibilities` enables rollback — if a guess fails, reset every entry tagged with that round back to 0.

### `mark(position, round, value)`

When a cell is solved:
1. Set `solution[position] = value`
2. Eliminate `value` from all 20 peers (same row, column, box)
3. Eliminate all other values from `position` itself
4. Tag every elimination with `round` for rollback

### `rollbackRound(round)`

Undo everything from a specific round:
1. For each cell where `solutionRound[cell] === round`: reset solution to 0
2. For each possibility where `possibilities[i] === round`: reset to 0
3. Pop log entries from that round

---

## Solving Techniques

Applied in this exact order by `singleSolveMove(round)`. Returns after the first technique that makes progress.

### 1. Naked Single (rating: SIMPLE)
A cell has exactly 1 candidate remaining → place it.

### 2. Hidden Single — Box (rating: EASY)
A value has only 1 possible cell within a 3×3 box → place it.

### 3. Hidden Single — Row (rating: EASY)
A value has only 1 possible cell within a row → place it.

### 4. Hidden Single — Column (rating: EASY)
A value has only 1 possible cell within a column → place it.

### 5. Naked Pairs (rating: INTERMEDIATE)
Two cells in the same house share the same 2 candidates and only those 2 → eliminate those candidates from all other cells in that house. Check row, column, and box.

### 6. Pointing Pairs/Triples — Row (rating: INTERMEDIATE)
If a value within a box is confined to a single row → eliminate that value from the rest of that row (outside the box).

### 7. Pointing Pairs/Triples — Column (rating: INTERMEDIATE)
Same as above but for columns.

### 8. Box/Line Reduction — Row (rating: INTERMEDIATE)
If a value within a row is confined to a single box → eliminate that value from the rest of that box (outside the row).

### 9. Box/Line Reduction — Column (rating: INTERMEDIATE)
Same as above but for columns.

### 10. Hidden Pairs — Row (rating: INTERMEDIATE)
Two values that only appear in the same two cells in a row → eliminate all other candidates from those two cells.

### 11. Hidden Pairs — Column (rating: INTERMEDIATE)
Same as above but for columns.

### 12. Hidden Pairs — Box (rating: INTERMEDIATE)
Same as above but for boxes.

If none of these techniques make progress → fall back to guessing (pick the cell with fewest candidates, try each value, recurse). Guessing = EXPERT difficulty.

---

## Solve Loop

```
solve(round):
  while singleSolveMove(round):
    if solved → return true
    if impossible → return false

  // Logic exhausted — guess
  pick cell with fewest candidates (randomized order)
  for each candidate (randomized order):
    mark as guess (odd round)
    if solve(round + 2) → return true
    else → rollbackRound(round + 2), rollbackRound(round + 1)

  return false
```

Round numbering: even rounds = logic, odd rounds = guesses. `rollbackNonGuesses()` removes all even-round placements (used during generation to strip redundant givens).

---

## Puzzle Generation

```
generatePuzzle(symmetry?):
  1. Shuffle cell-visit order and digit-try order (Fisher-Yates)
  2. solve() on empty grid → random complete solution
  3. If no symmetry: rollbackNonGuesses() — strip cells the solver can re-derive
  4. Copy current solution as puzzle (these are the givens)
  5. Re-shuffle arrays
  6. For each cell (shuffled order):
     a. Remove cell (+ symmetric counterpart if using symmetry)
     b. countSolutions(limit=2) — uses the same logic solver + guess fallback
     c. If solutions > 1 → put it back
  7. Reset, return puzzle
```

### countSolutions(round, limitToTwo)

Same structure as solve but counts instead of stopping at first solution. Stops early at 2 if `limitToTwo` is set.

---

## Difficulty Classification

After solving with history recording enabled:

```
if guessCount > 0        → EXPERT
if boxLineReduction > 0  → INTERMEDIATE
if pointingPairTriple > 0 → INTERMEDIATE
if hiddenPairCount > 0   → INTERMEDIATE
if nakedPairCount > 0    → INTERMEDIATE
if hiddenSingleCount > 0 → EASY
if singleCount > 0       → SIMPLE
```

### Difficulty type update

```typescript
// Old
type Difficulty = 'easy' | 'medium' | 'hard'

// New
type Difficulty = 'simple' | 'easy' | 'intermediate' | 'expert'
```

### Generation strategy per difficulty

Instead of "remove N cells," generate puzzles and classify them:

```
generatePuzzleWithDifficulty(target):
  loop (max attempts):
    puzzle = generatePuzzle(symmetry = ROTATE180)
    solve with recordHistory = true
    if getDifficulty() === target → return puzzle
  
  // Fallback: return best match
```

This may take multiple attempts for specific difficulties. For Devvit, pre-generate at post creation time — 3 puzzles (easy, intermediate, expert) should complete well within 30s.

---

## Symmetry Support

Optional symmetric clue removal for aesthetically pleasing puzzles.

| Symmetry | Description |
|----------|-------------|
| NONE | Random removal order, no pattern |
| ROTATE180 | Remove cell + its 180° rotation partner |
| ROTATE90 | Remove cell + 3 rotation partners (90°, 180°, 270°) |
| MIRROR | Remove cell + its horizontal mirror |
| FLIP | Remove cell + its vertical mirror |

Default: ROTATE180 (most common in published puzzles, removes 2 cells at a time).

---

## Solve History / Log

Each solving step is recorded as a LogItem:

```typescript
type LogType =
  | 'given'
  | 'single'
  | 'hiddenSingleRow' | 'hiddenSingleColumn' | 'hiddenSingleSection'
  | 'nakedPairRow' | 'nakedPairColumn' | 'nakedPairSection'
  | 'pointingPairTripleRow' | 'pointingPairTripleColumn'
  | 'rowBox' | 'columnBox'
  | 'hiddenPairRow' | 'hiddenPairColumn' | 'hiddenPairSection'
  | 'guess' | 'rollback'

type LogItem = {
  round: number
  type: LogType
  value: number    // 0 if N/A
  position: number // 0-80, -1 if N/A
}
```

This log serves three purposes:
1. Difficulty classification (check which technique types appear)
2. Solve statistics (count of each technique used)
3. Future hint system (replay log entries as step-by-step explanations)

---

## File Changes

### Modified files

| File | Change |
|------|--------|
| `src/server/lib/sudoku.ts` | Full rewrite: candidate-tracking solver, technique implementations, generation with symmetry, difficulty classification |
| `src/server/lib/__tests__/sudoku.test.ts` | Full rewrite: test each technique, generation, difficulty grading |
| `src/client/lib/types.ts` | Update `Difficulty` type to 4 levels |
| `src/client/App.svelte` | Update difficulty picker for 4 levels |
| `src/client/components/Grid.svelte` | No change (conflict detection stays client-side) |
| `src/client/components/NumberPad.svelte` | No change |
| `src/client/lib/sudoku-utils.ts` | No change (client-side conflict detection is independent) |
| `src/server/index.ts` | Minor: update difficulty validation |
| `src/server/post.ts` | Update to generate 4 difficulties instead of 3 |

### New files

None. All new code goes into the existing `sudoku.ts`.

---

## Build Order

### Phase 1: Core solver infrastructure
1. Candidate array helpers: `mark`, `rollbackRound`, index math, `isImpossible`, `isSolved`
2. Naked Single (`onlyPossibilityForCell`)
3. Hidden Singles (`onlyValueInSection`, `onlyValueInRow`, `onlyValueInColumn`)
4. Solve loop with guess/backtrack fallback
5. Tests for each of the above

### Phase 2: Intermediate techniques
6. Naked Pairs (`handleNakedPairs`)
7. Pointing Pairs/Triples (`pointingRowReduction`, `pointingColumnReduction`)
8. Box/Line Reduction (`rowBoxReduction`, `colBoxReduction`)
9. Hidden Pairs (`hiddenPairInRow`, `hiddenPairInColumn`, `hiddenPairInSection`)
10. Tests for each technique

### Phase 3: Generation + grading
11. `generatePuzzle` with symmetry support
12. `countSolutions` using the logic solver
13. `getDifficulty` from solve history
14. `generatePuzzleWithDifficulty` retry loop
15. Tests for generation and difficulty classification

### Phase 4: Integration
16. Update `Difficulty` type in `types.ts`
17. Update `post.ts` to generate 4 difficulties
18. Update `index.ts` route validation
19. Update `App.svelte` difficulty picker
20. Run full test suite: `bun run test && bun run type-check`

---

## Performance Budget

| Operation | Expected time | Devvit limit |
|-----------|--------------|-------------|
| Single puzzle generation | 50–500ms | — |
| Difficulty-targeted generation (with retries) | 200ms–3s | — |
| 4 puzzles at post creation | 1–10s | 30s |
| countSolutions per cell removal | 1–50ms | — |

If generation for a specific difficulty takes too many retries, accept the closest match. A puzzle graded EASY when SIMPLE was requested is still a valid, playable puzzle.

---

## What This Plan Does NOT Cover

| Feature | Why deferred |
|---------|-------------|
| Hint system UI | Needs client-side work; solver log is the foundation but UI is separate |
| Sukaku Explainer-style numeric ratings | QQWing's 4-tier classification is sufficient for now |
| Advanced techniques (X-Wing, Swordfish, XY-Wing, chains) | Not needed — puzzles requiring these would be EXPERT via guessing anyway |
| Pre-generated puzzle bank via scheduler | Optimization; direct generation at post creation is fast enough |
| Pencil marks / notes UI | Client feature, independent of solver |
