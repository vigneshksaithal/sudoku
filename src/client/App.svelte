<script lang="ts">
	import { onMount, untrack } from "svelte";
	import Grid from "./components/Grid.svelte";
	import NumberPad from "./components/NumberPad.svelte";
	import {
		boardToString,
		countDigitPlacements,
		isComplete,
		parseBoard,
		updateConflicts,
	} from "./lib/sudoku-utils";
	import {
		createEmptyNotesBoard,
		toggleNote,
		clearCellNotes,
		cleanupNotes,
	} from "./lib/notes-utils";
	import {
		EMPTY_SELECTION,
		clearSelection,
		extendSelection,
		isMultiSelection,
		moveFocus,
		setSelection,
		toggleSelection,
	} from "./lib/selection-utils";
	import {
		applyAutoNotes,
		applyMultiErase,
		applyAutoCandidates,
		hasAutoCandidates,
		clearAutoCandidates,
	} from "./lib/app-logic";
	import {
		DIFFICULTY_STORAGE_KEY,
		PAD_ALIGNMENT_STORAGE_KEY,
		getNextDifficulty,
	} from "./lib/constants";
	import HintPanel from "./components/HintPanel.svelte";
	import { findTechniqueHint } from "./lib/technique-hints/technique-engine";
	import { buildCandidateBoard } from "./lib/technique-hints/candidate-board";
	import {
		pushSnapshot,
		popSnapshot,
		clearStack,
		captureSnapshot,
		restoreNotesBoard,
	} from "./lib/undo-stack";
	import type { Selection } from "./lib/selection-utils";
	import type { UndoStack } from "./lib/undo-stack";
	import type {
		CellState,
		Difficulty,
		GameScreen,
		NotesBoard,
		TechniqueHint,
	} from "./lib/types";

	const ARROW_MOVES: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
	} as const;

	const DIFFICULTIES: readonly Difficulty[] = [
		"simple",
		"easy",
		"intermediate",
		"expert",
	] as const;

	let { difficulty: initialDifficulty }: { difficulty: Difficulty } =
		$props();
	let difficulty: Difficulty = $state(untrack(() => initialDifficulty));

	let screen: GameScreen = $state("playing");
	let puzzles: Record<Difficulty, string> | null = $state(null);
	let solutions: Record<Difficulty, string> | null = $state(null);
	let board: CellState[][] = $state([]);
	let selection: Selection = $state(EMPTY_SELECTION);
	let loading = $state(true);
	let error: string | null = $state(null);
	let validating = $state(false);
	let validationMessage: string | null = $state(null);
	let notesMode = $state(false);
	let notesBoard: NotesBoard = $state(createEmptyNotesBoard());
	let hintsUsed: number = $state(0);
	let activeHint: TechniqueHint | null = $state(null);
	let undoStack: UndoStack = $state([]);

	const hintsDisabled = $derived(
		screen !== "playing" || solutions === null || activeHint !== null,
	);
	const techniqueHighlight = $derived.by(() => {
		const hint: TechniqueHint | null = activeHint;
		if (hint === null) return null;
		return {
			primaryCells: hint.primaryCells,
			secondaryCells: hint.secondaryCells,
		};
	});
	const undoDisabled = $derived(
		undoStack.length === 0 || screen !== "playing",
	);

	let padAlignment: "left" | "right" = $state(
		(() => {
			try {
				const stored = localStorage.getItem(PAD_ALIGNMENT_STORAGE_KEY);
				return stored === "right" ? "right" : "left";
			} catch {
				return "left";
			}
		})(),
	);

	const digitCounts: ReadonlyMap<number, number> = $derived(
		countDigitPlacements(board),
	);

	const handleToggleAlignment = (): void => {
		padAlignment = padAlignment === "left" ? "right" : "left";
		try {
			localStorage.setItem(PAD_ALIGNMENT_STORAGE_KEY, padAlignment);
		} catch {
			// localStorage unavailable — preference not persisted
		}
	};

	let highlightDigit: number | null = $state(null);

	const fetchPuzzles = async (): Promise<void> => {
		loading = true;
		error = null;
		try {
			const res = await fetch("/api/puzzle");
			const json = await res.json();
			if (!res.ok)
				throw new Error(json.message ?? "Failed to load puzzles");
			puzzles = json.data.puzzles;
			solutions = json.data.solutions ?? null;
			if (puzzles) {
				board = updateConflicts(parseBoard(puzzles[difficulty]));
				selection = EMPTY_SELECTION;
				highlightDigit = null;
				validationMessage = null;
				notesBoard = createEmptyNotesBoard();
				notesMode = false;
				hintsUsed = 0;
				activeHint = null;
				undoStack = clearStack();
			}
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load puzzles";
			solutions = null;
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		fetchPuzzles();
	});

	const handleUndo = (): void => {
		if (undoDisabled) return;
		const [snapshot, next] = popSnapshot(undoStack);
		if (snapshot === null) return;
		undoStack = next;
		board = updateConflicts(snapshot.board);
		notesBoard = restoreNotesBoard(snapshot.notes);
		hintsUsed = snapshot.hintsUsed;
	};

	const handleAutoCandidate = (): void => {
		if (screen !== "playing") return;
		undoStack = pushSnapshot(
			undoStack,
			captureSnapshot(board, notesBoard, hintsUsed),
		);
		if (hasAutoCandidates(board, notesBoard)) {
			clearAutoCandidates(board, notesBoard);
		} else {
			applyAutoCandidates(board, notesBoard);
		}
	};

	const handleCellSelect = (row: number, col: number): void => {
		selection = setSelection(row, col);
		const cellValue = board[row]?.[col]?.value;
		if (cellValue !== undefined && cellValue > 0) {
			highlightDigit = cellValue;
		}
	};

	const handleCellExtend = (row: number, col: number): void => {
		selection = extendSelection(selection, row, col);
	};

	const handleCellToggle = (row: number, col: number): void => {
		selection = toggleSelection(selection, row, col);
	};

	const handleKeyDown = (e: KeyboardEvent): void => {
		if ((e.ctrlKey || e.metaKey) && e.key === "z") {
			e.preventDefault();
			handleUndo();
			return;
		}
		if (screen !== "playing") return;

		const key = e.key;

		// Escape: clear selection
		if (key === "Escape") {
			selection = clearSelection();
			highlightDigit = null;
			return;
		}

		if (selection.focusCell === null) return;
		const [selectedRow, selectedCol] = selection.focusCell;

		// Shift+digit: toggle note regardless of notesMode
		if (e.shiftKey && key >= "1" && key <= "9") {
			const cell = board[selectedRow]?.[selectedCol];
			if (cell && !cell.isGiven && cell.value === 0) {
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				toggleNote(notesBoard, selectedRow, selectedCol, parseInt(key));
			}
			return;
		}

		if (key >= "1" && key <= "9") {
			handleNumber(parseInt(key));
			return;
		}

		if (key === "Backspace" || key === "Delete" || key === "0") {
			e.preventDefault();
			handleErase();
			return;
		}

		const move = ARROW_MOVES[key];
		if (move) {
			e.preventDefault();
			const [dr, dc] = move;
			selection = moveFocus(selection.focusCell, dr, dc);
		}
	};

	const handleNumber = (num: number): void => {
		highlightDigit = num;
		undoStack = pushSnapshot(
			undoStack,
			captureSnapshot(board, notesBoard, hintsUsed),
		);

		if (isMultiSelection(selection)) {
			applyAutoNotes(board, notesBoard, selection, num);
			return;
		}

		if (selection.focusCell === null) return;
		const [selectedRow, selectedCol] = selection.focusCell;
		const cell = board[selectedRow]?.[selectedCol];
		if (!cell || cell.isGiven) return;

		if (notesMode) {
			// In notes mode: only toggle note if cell has no value
			if (cell.value !== 0) return;
			toggleNote(notesBoard, selectedRow, selectedCol, num);
		} else {
			// Normal mode: place value, clear cell notes, cleanup peer notes
			board[selectedRow]![selectedCol] = { ...cell, value: num };
			board = updateConflicts(board);
			clearCellNotes(notesBoard, selectedRow, selectedCol);
			cleanupNotes(notesBoard, selectedRow, selectedCol, num);
			checkCompletion();
		}
	};

	const handleErase = (): void => {
		undoStack = pushSnapshot(
			undoStack,
			captureSnapshot(board, notesBoard, hintsUsed),
		);

		if (isMultiSelection(selection)) {
			applyMultiErase(board, notesBoard, selection);
			return;
		}

		if (selection.focusCell === null) return;
		const [selectedRow, selectedCol] = selection.focusCell;
		const cell = board[selectedRow]?.[selectedCol];
		if (!cell || cell.isGiven) return;

		if (notesMode) {
			// In notes mode: clear notes from selected cell, don't touch value
			clearCellNotes(notesBoard, selectedRow, selectedCol);
		} else {
			// Normal mode: clear the cell's value (do NOT restore notes)
			board[selectedRow]![selectedCol] = { ...cell, value: 0 };
			board = updateConflicts(board);
		}
	};

	const handleHint = (): void => {
		if (solutions === null || activeHint !== null) return;
		const solutionStr = solutions[difficulty];
		if (!solutionStr) return;
		const solutionFlat = Array.from(solutionStr).map(Number);
		const candidates = buildCandidateBoard(board, notesBoard);
		const hint = findTechniqueHint(board, candidates, solutionFlat);
		if (hint === null) return;
		activeHint = hint;
		hintsUsed++;
	};

	const checkCompletion = async (): Promise<void> => {
		if (!isComplete(board)) return;
		validating = true;
		validationMessage = null;
		try {
			const res = await fetch("/api/validate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					board: boardToString(board),
					difficulty,
				}),
			});
			const json = await res.json();
			if (json.valid) {
				screen = "completed";
			} else {
				validationMessage = "Not quite right — check your solution.";
			}
		} catch {
			validationMessage = "Could not validate. Try again.";
		} finally {
			validating = false;
		}
	};

	const handleApplyHint = (): void => {
		if (activeHint === null) return;
		undoStack = pushSnapshot(
			undoStack,
			captureSnapshot(board, notesBoard, hintsUsed),
		);
		if (activeHint.action === "placement") {
			const [row, col] = activeHint.primaryCells[0]!;
			// Stale hint guard: cell may have been filled since hint was generated
			if (board[row]?.[col]?.value !== 0) {
				activeHint = null;
				return;
			}
			board[row]![col] = {
				...board[row]![col]!,
				value: activeHint.digit,
			};
			clearCellNotes(notesBoard, row, col);
			cleanupNotes(notesBoard, row, col, activeHint.digit);
		} else {
			for (const elim of activeHint.eliminations ?? []) {
				for (const digit of elim.digits) {
					notesBoard[elim.row]?.[elim.col]?.delete(digit);
				}
			}
		}
		board = updateConflicts(board);
		activeHint = null;
		checkCompletion();
	};

	const handleDismissHint = (): void => {
		activeHint = null;
	};

	const changeDifficulty = (next: Difficulty): void => {
		if (next === difficulty || puzzles === null) return;
		try {
			localStorage.setItem(DIFFICULTY_STORAGE_KEY, next);
		} catch {
			// localStorage unavailable — preference not persisted
		}
		difficulty = next;
		board = updateConflicts(parseBoard(puzzles[next]));
		selection = EMPTY_SELECTION;
		highlightDigit = null;
		validationMessage = null;
		notesBoard = createEmptyNotesBoard();
		notesMode = false;
		hintsUsed = 0;
		activeHint = null;
		undoStack = clearStack();
		screen = "playing";
	};

	const nextDifficulty = $derived(getNextDifficulty(difficulty));
</script>

<svelte:window onkeydown={handleKeyDown} />

<main
	class="flex min-h-screen items-center justify-center p-4 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
>
	{#if loading}
		<p class="text-lg">Loading puzzles…</p>
	{:else if error}
		<div class="text-center space-y-4">
			<p class="text-red-600 dark:text-red-400">{error}</p>
			<button
				class="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
				onclick={() => fetchPuzzles()}
			>
				Retry
			</button>
		</div>
	{:else if screen === "playing"}
		<div
			class="flex flex-col items-center gap-3 w-full max-w-md px-2 sm:px-4"
		>
			<div class="flex items-center justify-center gap-1 w-full">
				{#each DIFFICULTIES as d (d)}
					<button
						class="px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
							{d === difficulty
							? 'bg-blue-600 text-white'
							: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}"
						onclick={() => changeDifficulty(d)}
					>
						{d}
					</button>
				{/each}
			</div>
			<Grid
				{board}
				{selection}
				{notesBoard}
				{highlightDigit}
				{techniqueHighlight}
				hintDigit={activeHint?.action === "placement"
					? activeHint.digit
					: null}
				onCellSelect={handleCellSelect}
				onCellExtend={handleCellExtend}
				onCellToggle={handleCellToggle}
				onDragEnd={() => {}}
			/>
			{#if activeHint !== null}
				<HintPanel
					hint={activeHint}
					onApply={handleApplyHint}
					onDismiss={handleDismissHint}
				/>
			{/if}
			<NumberPad
				onNumber={handleNumber}
				onErase={handleErase}
				{notesMode}
				onToggleNotes={() => {
					notesMode = !notesMode;
				}}
				onHint={handleHint}
				{hintsDisabled}
				onUndo={handleUndo}
				{undoDisabled}
				onAutoCandidate={handleAutoCandidate}
				autoCandidateDisabled={screen !== "playing"}
				{digitCounts}
				{padAlignment}
				onToggleAlignment={handleToggleAlignment}
			/>
			{#if validating}
				<p class="text-sm text-neutral-500">Checking…</p>
			{/if}
			{#if validationMessage}
				<p class="text-sm text-red-600 dark:text-red-400">
					{validationMessage}
				</p>
			{/if}
		</div>
	{:else if screen === "completed"}
		<div class="text-center space-y-6">
			<h1 class="text-3xl font-bold">🎉 Solved!</h1>
			<p class="text-neutral-600 dark:text-neutral-400">
				You completed the {difficulty} puzzle.
			</p>
			<button
				class="px-5 py-3 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
				onclick={() => changeDifficulty(nextDifficulty)}
			>
				Try {nextDifficulty}
			</button>
		</div>
	{/if}
</main>
