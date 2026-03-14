# Bugfix Requirements Document

## Introduction

The hint system repeatedly suggests the same elimination hint (e.g., naked pair) even after the user has already applied it. This happens because `buildCandidateBoard` computes candidates purely from placed board values and ignores the user's pencil marks (`notesBoard`). After applying an elimination hint, only the `notesBoard` is updated (digits removed from `SvelteSet` entries), but no values are placed on the board. The next hint request rebuilds candidates from scratch, rediscovers the same naked pair with the same "affected" cells, and presents the identical hint again. This creates a frustrating loop where the user wastes limited hints on duplicate suggestions.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user applies an elimination hint that removes digits from the notesBoard and then requests a new hint THEN the system rebuilds the candidate board from placed board values only, ignoring the notesBoard, and suggests the same elimination hint again

1.2 WHEN the user applies the same elimination hint multiple times THEN the system continues to count each duplicate against the hint limit, wasting the user's limited hints on redundant suggestions

### Expected Behavior (Correct)

2.1 WHEN the user applies an elimination hint that removes digits from the notesBoard and then requests a new hint THEN the system SHALL incorporate the notesBoard eliminations into the candidate board so that already-eliminated digits are not treated as candidates, and the same hint SHALL NOT be suggested again

2.2 WHEN the user requests a hint after applying a previous elimination hint THEN the system SHALL only count genuinely new hints against the hint limit, not re-discoveries of already-applied eliminations

### Unchanged Behavior (Regression Prevention)

3.1 WHEN no elimination hints have been applied and the user requests a hint THEN the system SHALL CONTINUE TO compute candidates from placed board values and return the correct technique hint

3.2 WHEN the user applies a placement hint (placing a value on the board) and then requests a new hint THEN the system SHALL CONTINUE TO correctly reflect the placed value in the rebuilt candidate board and suggest the next appropriate hint

3.3 WHEN the user manually places a value on the board (not via hint) and then requests a hint THEN the system SHALL CONTINUE TO compute candidates correctly from the updated board state

3.4 WHEN the notesBoard has no user-applied eliminations for a given cell THEN the candidate board for that cell SHALL CONTINUE TO be computed purely from placed board values as before

---

### Bug Condition (Structured Pseudocode)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type HintRequest { board, notesBoard, previousHintApplied }
  OUTPUT: boolean

  // The bug triggers when an elimination hint was previously applied
  // (digits removed from notesBoard) but no new values were placed on the board
  candidates ← buildCandidateBoard(X.board)  // ignores notesBoard
  hint ← findTechniqueHint(X.board, candidates, solution)
  
  RETURN X.previousHintApplied.action = "elimination"
     AND hint IS NOT NULL
     AND hint describes the same elimination as X.previousHintApplied
END FUNCTION
```

### Fix Checking Property

```pascal
// Property: Fix Checking — No duplicate elimination hints
FOR ALL X WHERE isBugCondition(X) DO
  candidates' ← buildCandidateBoard'(X.board, X.notesBoard)
  hint ← findTechniqueHint(X.board, candidates', solution)
  
  ASSERT hint ≠ X.previousHintApplied
     // The same elimination hint must not be returned after it was applied
END FOR
```

### Preservation Checking Property

```pascal
// Property: Preservation Checking — Non-buggy inputs behave identically
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT F(X) = F'(X)
  // When no elimination hint was previously applied, or when the notesBoard
  // has no relevant eliminations, the candidate board and hint results
  // must be identical to the original behavior
END FOR
```
