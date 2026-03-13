# Tasks

## Task 1: Add technique hint types to types.ts

- [x] 1.1 Add `TechniqueType`, `TechniqueDifficulty`, `TechniqueAction`, `TechniqueHint`, `CandidateBoard`, and `TechniqueHighlight` types to `src/client/lib/types.ts`
  - Requirements: R9
  - Files: `src/client/lib/types.ts`

## Task 2: Implement candidate board computation

- [x] 2.1 Write unit tests for `buildCandidateBoard` in `src/client/lib/technique-hints/__tests__/candidate-board.test.ts` — empty board (all 9 candidates), filled board (all empty sets), partial board (correct candidates)
  - Requirements: R1.1, R1.2, R1.3
  - Files: `src/client/lib/technique-hints/__tests__/candidate-board.test.ts`
- [x] 2.2 Write property tests for `buildCandidateBoard` in `src/client/lib/technique-hints/__tests__/candidate-board.property.test.ts` — filled cells have empty sets, candidates don't conflict with peers
  - Requirements: R1.2, R1.3, R1.4
  - Files: `src/client/lib/technique-hints/__tests__/candidate-board.property.test.ts`
- [x] 2.3 Implement `buildCandidateBoard` in `src/client/lib/technique-hints/candidate-board.ts`
  - Requirements: R1.1, R1.2, R1.3, R1.4
  - Files: `src/client/lib/technique-hints/candidate-board.ts`

## Task 3: Implement naked single detection

- [x] 3.1 Write unit tests for `detectNakedSingle` in `src/client/lib/technique-hints/__tests__/naked-single.test.ts` — finds single-candidate cell, returns null when none, returns lowest index on ties, digit matches solution
  - Requirements: R2.1, R2.2, R2.3, R2.4, R2.5
  - Files: `src/client/lib/technique-hints/__tests__/naked-single.test.ts`
- [x] 3.2 Write property tests for `detectNakedSingle` in `src/client/lib/technique-hints/__tests__/naked-single.property.test.ts` — returned cell has candidates.size === 1, digit matches solution
  - Requirements: R2.1, R2.2, R2.3
  - Files: `src/client/lib/technique-hints/__tests__/naked-single.property.test.ts`
- [x] 3.3 Implement `detectNakedSingle` in `src/client/lib/technique-hints/naked-single.ts`
  - Requirements: R2.1, R2.2, R2.3, R2.4, R2.5
  - Files: `src/client/lib/technique-hints/naked-single.ts`

## Task 4: Implement hidden single detection

- [x] 4.1 Write unit tests for `detectHiddenSingle` in `src/client/lib/technique-hints/__tests__/hidden-single.test.ts` — finds digit restricted to one cell in row/col/box, returns null when none, checks unit order, digit matches solution
  - Requirements: R3.1, R3.2, R3.3, R3.4
  - Files: `src/client/lib/technique-hints/__tests__/hidden-single.test.ts`
- [x] 4.2 Write property tests for `detectHiddenSingle` in `src/client/lib/technique-hints/__tests__/hidden-single.property.test.ts` — digit is unique in its unit, digit matches solution
  - Requirements: R3.1, R3.2
  - Files: `src/client/lib/technique-hints/__tests__/hidden-single.property.test.ts`
- [x] 4.3 Implement `detectHiddenSingle` in `src/client/lib/technique-hints/hidden-single.ts`
  - Requirements: R3.1, R3.2, R3.3, R3.4
  - Files: `src/client/lib/technique-hints/hidden-single.ts`

## Task 5: Implement naked pair detection

- [x] 5.1 Write unit tests for `detectNakedPair` in `src/client/lib/technique-hints/__tests__/naked-pair.test.ts` — finds pair with identical 2-candidate sets, returns correct eliminations, returns null when no useful pair
  - Requirements: R4.1, R4.2, R4.3, R4.4
  - Files: `src/client/lib/technique-hints/__tests__/naked-pair.test.ts`
- [x] 5.2 Write property tests for `detectNakedPair` in `src/client/lib/technique-hints/__tests__/naked-pair.property.test.ts` — primary cells have identical size-2 sets, eliminations target actual candidates
  - Requirements: R4.1, R4.2, R4.3, R9.5
  - Files: `src/client/lib/technique-hints/__tests__/naked-pair.property.test.ts`
- [x] 5.3 Implement `detectNakedPair` in `src/client/lib/technique-hints/naked-pair.ts`
  - Requirements: R4.1, R4.2, R4.3, R4.4
  - Files: `src/client/lib/technique-hints/naked-pair.ts`

## Task 6: Implement hidden pair detection

- [x] 6.1 Write unit tests for `detectHiddenPair` in `src/client/lib/technique-hints/__tests__/hidden-pair.test.ts` — finds two digits restricted to same two cells, returns correct eliminations, returns null when none
  - Requirements: R5.1, R5.2, R5.3, R5.4
  - Files: `src/client/lib/technique-hints/__tests__/hidden-pair.test.ts`
- [x] 6.2 Write property tests for `detectHiddenPair` in `src/client/lib/technique-hints/__tests__/hidden-pair.property.test.ts` — pair digits restricted to exactly those two cells, eliminations remove only non-pair candidates
  - Requirements: R5.1, R5.3, R9.5
  - Files: `src/client/lib/technique-hints/__tests__/hidden-pair.property.test.ts`
- [x] 6.3 Implement `detectHiddenPair` in `src/client/lib/technique-hints/hidden-pair.ts`
  - Requirements: R5.1, R5.2, R5.3, R5.4
  - Files: `src/client/lib/technique-hints/hidden-pair.ts`

## Task 7: Implement pointing pair detection

- [x] 7.1 Write unit tests for `detectPointingPair` in `src/client/lib/technique-hints/__tests__/pointing-pair.test.ts` — finds aligned candidates in box, returns correct eliminations, returns null when none
  - Requirements: R6.1, R6.2, R6.3, R6.4
  - Files: `src/client/lib/technique-hints/__tests__/pointing-pair.test.ts`
- [x] 7.2 Write property tests for `detectPointingPair` in `src/client/lib/technique-hints/__tests__/pointing-pair.property.test.ts` — primary cells in same box and row/col, eliminations target cells outside box
  - Requirements: R6.1, R6.2, R6.3, R9.5
  - Files: `src/client/lib/technique-hints/__tests__/pointing-pair.property.test.ts`
- [x] 7.3 Implement `detectPointingPair` in `src/client/lib/technique-hints/pointing-pair.ts`
  - Requirements: R6.1, R6.2, R6.3, R6.4
  - Files: `src/client/lib/technique-hints/pointing-pair.ts`

## Task 8: Implement box/line reduction detection

- [x] 8.1 Write unit tests for `detectBoxLineReduction` in `src/client/lib/technique-hints/__tests__/box-line-reduction.test.ts` — finds candidates in row/col restricted to one box, returns correct eliminations, returns null when none
  - Requirements: R7.1, R7.2, R7.3, R7.4
  - Files: `src/client/lib/technique-hints/__tests__/box-line-reduction.test.ts`
- [x] 8.2 Write property tests for `detectBoxLineReduction` in `src/client/lib/technique-hints/__tests__/box-line-reduction.property.test.ts` — primary cells in same row/col and box, eliminations target cells in box outside line
  - Requirements: R7.1, R7.2, R7.3, R9.5
  - Files: `src/client/lib/technique-hints/__tests__/box-line-reduction.property.test.ts`
- [x] 8.3 Implement `detectBoxLineReduction` in `src/client/lib/technique-hints/box-line-reduction.ts`
  - Requirements: R7.1, R7.2, R7.3, R7.4
  - Files: `src/client/lib/technique-hints/box-line-reduction.ts`

## Task 9: Implement technique detection pipeline

- [x] 9.1 Write unit tests for `findTechniqueHint` in `src/client/lib/technique-hints/__tests__/technique-engine.test.ts` — returns highest-priority technique, returns null on complete board, returns null when no techniques apply
  - Requirements: R8.1, R8.2, R8.3, R8.4
  - Files: `src/client/lib/technique-hints/__tests__/technique-engine.test.ts`
- [x] 9.2 Write property tests for `findTechniqueHint` in `src/client/lib/technique-hints/__tests__/technique-engine.property.test.ts` — pipeline priority ordering, null on complete board, placement hints match solution
  - Requirements: R8.1, R8.2, R8.4, R8.5
  - Files: `src/client/lib/technique-hints/__tests__/technique-engine.property.test.ts`
- [x] 9.3 Implement `findTechniqueHint` in `src/client/lib/technique-hints/technique-engine.ts`
  - Requirements: R8.1, R8.2, R8.3, R8.4, R8.5
  - Files: `src/client/lib/technique-hints/technique-engine.ts`

## Task 10: Update Grid.svelte for multi-cell technique highlighting

- [x] 10.1 Replace `hintCell` prop with `techniqueHighlight` prop in `src/client/components/Grid.svelte` — add primary (green/teal) and secondary (blue/cyan) highlight classes, maintain precedence rules
  - Requirements: R12.1, R12.2, R12.3, R12.4, R12.5
  - Files: `src/client/components/Grid.svelte`

## Task 11: Create HintPanel.svelte component

- [x] 11.1 Create `src/client/components/HintPanel.svelte` — display technique name, difficulty, explanation, Apply button, Dismiss button with proper ARIA roles
  - Requirements: R11.1, R11.2, R11.3, R11.4, R11.5, R11.6
  - Files: `src/client/components/HintPanel.svelte`

## Task 12: Rework App.svelte hint orchestration

- [x] 12.1 Replace `hintCell` state with `activeHint` state, add `techniqueHighlight` derived, update `hintsDisabled` to include `activeHint !== null` check
  - Requirements: R10.5, R13.7
  - Files: `src/client/App.svelte`
- [x] 12.2 Rewrite `handleHint` to build candidate board, call `findTechniqueHint`, set `activeHint`, increment `hintsUsed` without modifying board
  - Requirements: R13.1, R13.2, R13.3, R13.4, R13.5, R13.6, R13.7
  - Files: `src/client/App.svelte`
- [x] 12.3 Implement `handleApplyHint` — push undo snapshot, apply placement (set value, clear/cleanup notes) or elimination (remove candidates from notes), recalculate conflicts, clear activeHint, check completion
  - Requirements: R14.1, R14.2, R14.3, R14.4, R14.5, R14.6, R14.7, R15.1, R15.2, R15.3, R15.4, R15.5
  - Files: `src/client/App.svelte`
- [x] 12.4 Implement `handleDismissHint` — clear activeHint without modifying board or decrementing hintsUsed
  - Requirements: R16.1, R16.2, R16.3, R16.4
  - Files: `src/client/App.svelte`
- [~] 12.5 Add stale hint protection — validate primary cell is still empty before applying placement hint
  - Requirements: R18.1, R18.2
  - Files: `src/client/App.svelte`
- [~] 12.6 Wire HintPanel and updated Grid into App.svelte template — pass activeHint, techniqueHighlight, onApply, onDismiss props
  - Requirements: R11.1, R11.6, R12.1, R12.5
  - Files: `src/client/App.svelte`

## Task 13: Remove old hint-logic.ts and update imports

- [~] 13.1 Remove or repurpose `src/client/lib/hint-logic.ts` — remove `getBestHintCell`, `countValidCandidates`, `isHintApplicable` since they are replaced by the technique engine
  - Requirements: R8
  - Files: `src/client/lib/hint-logic.ts`, `src/client/App.svelte`
- [~] 13.2 Update or remove old hint-logic tests in `src/client/lib/__tests__/hint-logic.test.ts` and `src/client/lib/__tests__/hint-logic.property.test.ts`
  - Files: `src/client/lib/__tests__/hint-logic.test.ts`, `src/client/lib/__tests__/hint-logic.property.test.ts`

## Task 14: Integration testing and final verification

- [~] 14.1 Run `bun run test` and verify all tests pass (old and new)
  - Requirements: All
- [~] 14.2 Run `bun run type-check` and verify zero type errors
  - Requirements: All
