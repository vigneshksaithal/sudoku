# Stale Hint Dedup Bugfix Design

## Overview

The hint system repeatedly suggests the same elimination hint (e.g., naked pair) because `buildCandidateBoard` computes candidates purely from placed board values, ignoring the user's pencil marks (`notesBoard`). After applying an elimination hint, only `notesBoard` is updated (digits removed from `SvelteSet` entries), but no values are placed on the board. The next hint request rebuilds candidates from scratch, rediscovers the same naked pair, and presents the identical hint again.

The fix is minimal: modify `buildCandidateBoard` to accept an optional `NotesBoard` parameter and intersect the computed candidates with the user's pencil marks when present. This ensures already-eliminated digits are excluded from the candidate board, preventing duplicate hints.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when an elimination hint has been applied (digits removed from `notesBoard`) but the candidate board is rebuilt without consulting `notesBoard`, causing the same hint to reappear
- **Property (P)**: The desired behavior — after applying an elimination hint, `buildCandidateBoard` incorporates `notesBoard` eliminations so the same hint is not suggested again
- **Preservation**: Existing behavior that must remain unchanged — candidate computation when no elimination hints have been applied, placement hints, manual value placement, and all non-hint interactions
- **`buildCandidateBoard`**: The function in `src/client/lib/technique-hints/candidate-board.ts` that computes possible digits for each empty cell based on placed board values
- **`NotesBoard`**: A `SvelteSet<number>[][]` (9x9 grid of sets) representing the user's pencil marks per cell
- **`CandidateBoard`**: A `ReadonlyArray<ReadonlyArray<ReadonlySet<number>>>` representing computed candidate digits per cell
- **`handleHint`**: The function in `src/client/App.svelte` that orchestrates hint generation by calling `buildCandidateBoard` and `findTechniqueHint`

## Bug Details

### Bug Condition

The bug manifests when a user applies an elimination hint (e.g., naked pair) that removes digits from `notesBoard`, then requests a new hint. The `buildCandidateBoard` function rebuilds candidates purely from placed board values, ignoring the `notesBoard` eliminations, so the technique engine rediscovers the same elimination pattern and suggests the identical hint.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { board: CellState[][], notesBoard: NotesBoard, previousHint: TechniqueHint }
  OUTPUT: boolean

  // The bug triggers when:
  // 1. An elimination hint was previously applied (digits removed from notesBoard)
  // 2. No new values were placed on the board since the hint
  // 3. The candidate board is rebuilt without consulting notesBoard
  candidates ← buildCandidateBoard(input.board)          // current: ignores notesBoard
  newHint ← findTechniqueHint(input.board, candidates, solution)

  RETURN input.previousHint.action = "elimination"
     AND newHint IS NOT NULL
     AND newHint.technique = input.previousHint.technique
     AND newHint.primaryCells = input.previousHint.primaryCells
     AND newHint.eliminations overlaps input.previousHint.eliminations
END FUNCTION
```

### Examples

- **Naked pair applied, same hint returns**: User applies a naked pair hint that eliminates digit 3 from R1C5. `notesBoard[0][4]` no longer contains 3. User requests next hint. `buildCandidateBoard` recomputes candidates from board values only — digit 3 reappears as a candidate for R1C5. The same naked pair hint is returned.
- **Two consecutive elimination hints**: User applies hint A (naked pair eliminating {3,7} from two cells). Requests hint B — gets hint A again. Applies hint A again (no-op since notes already updated). Requests hint C — gets hint A yet again. Infinite loop.
- **Elimination hint followed by placement hint**: User applies an elimination hint, then the next hint happens to be a naked single (placement). This works correctly because the placement changes the board, which `buildCandidateBoard` does reflect. Bug only manifests when consecutive elimination hints target overlapping candidates.
- **Edge case — empty notesBoard**: When `notesBoard` has no user-applied eliminations for a cell (the `SvelteSet` is empty), the candidate board should be computed purely from placed board values, identical to current behavior.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When `notesBoard` has no user-applied eliminations for a given cell, the candidate board for that cell is computed purely from placed board values (identical to current behavior)
- Placement hints (placing a value on the board) continue to work correctly — the placed value is reflected in the rebuilt candidate board
- Manual value placement by the user continues to update the candidate board correctly
- Mouse/keyboard interactions, undo, difficulty switching, and all non-hint flows remain unaffected
- The technique detection algorithms (`detectNakedPair`, `detectHiddenSingle`, etc.) receive the same `CandidateBoard` type and are not modified

**Scope:**
All inputs where no elimination hints have been previously applied, or where `notesBoard` cells are empty sets, should produce identical results to the original `buildCandidateBoard`. The fix only changes behavior when `notesBoard` contains non-empty sets for empty cells.

## Hypothesized Root Cause

Based on the bug description and code analysis, the root cause is:

1. **`buildCandidateBoard` ignores `notesBoard`**: The function signature is `(board: CellState[][]): CandidateBoard`. It computes candidates solely from `collectPeerValues` (placed digits in row, column, and box peers). It has no parameter for `notesBoard` and no mechanism to incorporate user eliminations.

2. **`handleHint` does not pass `notesBoard`**: In `App.svelte`, `handleHint` calls `buildCandidateBoard(board)` without passing `notesBoard`. Even if `buildCandidateBoard` accepted it, the call site doesn't provide it.

3. **Elimination hints only mutate `notesBoard`**: In `handleApplyHint`, the `else` branch (for elimination hints) iterates `activeHint.eliminations` and calls `notesBoard[elim.row]?.[elim.col]?.delete(digit)`. This correctly updates the pencil marks but does not place any values on the board. Since `buildCandidateBoard` only looks at placed values, the elimination is invisible to the next hint computation.

4. **No stale-hint detection**: There is no mechanism to compare a newly generated hint against previously applied hints. The system has no memory of which hints have been shown or applied.

The simplest fix addresses causes 1 and 2: make `buildCandidateBoard` accept an optional `NotesBoard` and intersect computed candidates with the notes when present. This is preferred over adding hint history tracking because it solves the problem at the source — the candidate board itself reflects reality.

## Correctness Properties

Property 1: Bug Condition — No duplicate elimination hints after applying

_For any_ input where an elimination hint has been applied (digits removed from `notesBoard`) and no new values have been placed on the board, the fixed `buildCandidateBoard` SHALL exclude the eliminated digits from the candidate sets, so that `findTechniqueHint` does NOT return the same elimination hint again.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Unchanged behavior for non-eliminated cells

_For any_ input where `notesBoard` cells are empty sets (no user-applied eliminations), the fixed `buildCandidateBoard` SHALL produce the same `CandidateBoard` as the original function, preserving all existing hint detection, placement hints, and manual gameplay behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src/client/lib/technique-hints/candidate-board.ts`

**Function**: `buildCandidateBoard`

**Specific Changes**:
1. **Add optional `NotesBoard` parameter**: Change signature from `(board: CellState[][])` to `(board: CellState[][], notesBoard?: NotesBoard)`. The parameter is optional to preserve backward compatibility with existing callers (tests, other modules).

2. **Intersect candidates with notes when present**: For each empty cell, after computing candidates from peer values, check if `notesBoard` has a non-empty set for that cell. If so, intersect the computed candidates with the notes set (only keep digits that appear in both). If the notes set is empty, use the computed candidates as-is (preserving current behavior).

3. **Import `NotesBoard` type**: Add `NotesBoard` to the type import from `'../types'`.

**File**: `src/client/App.svelte`

**Function**: `handleHint`

**Specific Changes**:
4. **Pass `notesBoard` to `buildCandidateBoard`**: Change `buildCandidateBoard(board)` to `buildCandidateBoard(board, notesBoard)` so that user eliminations are reflected in the candidate board.

**No changes needed to**:
- `src/client/lib/types.ts` — `NotesBoard` and `CandidateBoard` types are already correct
- `src/client/lib/technique-hints/technique-engine.ts` — receives `CandidateBoard`, no change needed
- `src/client/lib/technique-hints/naked-pair.ts` — receives `CandidateBoard`, no change needed
- Any other technique detection files

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Construct a board state where a naked pair exists, build the candidate board, apply the elimination to a `notesBoard`, then rebuild the candidate board and check if the same hint is returned. Run on UNFIXED code to observe the duplicate hint.

**Test Cases**:
1. **Naked pair re-detection**: Set up a board with a known naked pair. Apply the elimination to `notesBoard`. Rebuild candidates with `buildCandidateBoard(board)` (no notesBoard). Assert `findTechniqueHint` returns the same hint (will pass on unfixed code, demonstrating the bug).
2. **Multiple consecutive eliminations**: Apply the same elimination hint twice. Verify the hint is returned each time (demonstrates the infinite loop on unfixed code).
3. **Elimination followed by hint request**: Simulate the full `handleHint` → `handleApplyHint` → `handleHint` cycle and verify the second `handleHint` returns the same hint (will demonstrate the bug on unfixed code).

**Expected Counterexamples**:
- `buildCandidateBoard(board)` produces identical candidate sets before and after applying an elimination hint, because it ignores `notesBoard`
- `findTechniqueHint` returns the same `TechniqueHint` object (same technique, primaryCells, eliminations)
- Possible causes: `buildCandidateBoard` has no `notesBoard` parameter, `handleHint` does not pass `notesBoard`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  candidates' ← buildCandidateBoard(input.board, input.notesBoard)
  hint ← findTechniqueHint(input.board, candidates', solution)

  ASSERT hint = NULL OR hint ≠ input.previousHint
    // The same elimination hint must not be returned after it was applied
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  candidatesOriginal ← buildCandidateBoard_original(input.board)
  candidatesFixed ← buildCandidateBoard_fixed(input.board, emptyNotesBoard)

  ASSERT candidatesOriginal = candidatesFixed
    // When notesBoard is empty, behavior is identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random board configurations automatically
- It catches edge cases where the intersection logic might incorrectly narrow candidates
- It provides strong guarantees that behavior is unchanged when `notesBoard` is empty

**Test Plan**: Generate random valid Sudoku board states with empty `notesBoard` entries. Verify that `buildCandidateBoard(board)` and `buildCandidateBoard(board, emptyNotesBoard)` produce identical `CandidateBoard` results.

**Test Cases**:
1. **Empty notesBoard preservation**: For random boards, verify `buildCandidateBoard(board)` equals `buildCandidateBoard(board, emptyNotesBoard)`
2. **Omitted notesBoard preservation**: Verify `buildCandidateBoard(board)` (no second arg) equals `buildCandidateBoard(board, undefined)`
3. **Placement hint preservation**: After placing a value on the board, verify the candidate board correctly excludes the placed digit regardless of `notesBoard`
4. **Full candidate notesBoard preservation**: When `notesBoard` contains all computed candidates for a cell (no eliminations), verify the result matches the original

### Unit Tests

- Test `buildCandidateBoard` with `notesBoard` containing eliminations — verify eliminated digits are excluded
- Test `buildCandidateBoard` with empty `notesBoard` — verify identical output to no-arg call
- Test `buildCandidateBoard` with `notesBoard` where some cells have partial notes — verify intersection
- Test edge case: `notesBoard` cell has digits not in computed candidates — verify no extra digits added
- Test edge case: `notesBoard` cell has empty set — verify computed candidates used as-is

### Property-Based Tests

- Generate random 9x9 boards and empty `notesBoard` — verify `buildCandidateBoard(board)` equals `buildCandidateBoard(board, emptyNotesBoard)` (preservation)
- Generate random boards with random `notesBoard` eliminations — verify the result is always a subset of the original candidates (monotonicity: notes can only remove candidates, never add)
- Generate boards with known naked pairs, apply elimination to `notesBoard`, verify the hint is not re-suggested (fix checking)

### Integration Tests

- Test the full hint cycle in `App.svelte`: request hint → apply elimination → request hint → verify different hint or null
- Test that placement hints still work correctly after the `buildCandidateBoard` signature change
- Test undo after applying an elimination hint — verify the candidate board reflects the restored `notesBoard` state
