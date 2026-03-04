<script lang="ts">
	import Grid from "./components/Grid.svelte";
	import NumberPad from "./components/NumberPad.svelte";
	import {
		boardToString,
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
	import { applyAutoNotes, applyMultiErase } from "./lib/app-logic";
	import type { Selection } from "./lib/selection-utils";
	import type {
		CellState,
		Difficulty,
		GameScreen,
		NotesBoard,
	} from "./lib/types";

	const ARROW_MOVES: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
	} as const;

	let screen: GameScreen = $state("picking");
	let puzzles: Record<Difficulty, string> | null = $state(null);
	let difficulty: Difficulty = $state("simple");
	let board: CellState[][] = $state([]);
	let selection: Selection = $state(EMPTY_SELECTION);
	let loading = $state(true);
	let error: string | null = $state(null);
	let validating = $state(false);
	let validationMessage: string | null = $state(null);
	let notesMode = $state(false);
	let notesBoard: NotesBoard = $state(createEmptyNotesBoard());

	const highlightDigit = $derived(
		selection.focusCell
			? board[selection.focusCell[0]]?.[selection.focusCell[1]]?.value ||
					null
			: null,
	);

	const fetchPuzzles = async (): Promise<void> => {
		loading = true;
		error = null;
		try {
			const res = await fetch("/api/puzzle");
			const json = await res.json();
			if (!res.ok)
				throw new Error(json.message ?? "Failed to load puzzles");
			puzzles = json.data;
		} catch (e) {
			error = e instanceof Error ? e.message : "Failed to load puzzles";
		} finally {
			loading = false;
		}
	};

	fetchPuzzles();

	const selectDifficulty = (d: Difficulty): void => {
		if (!puzzles) return;
		difficulty = d;
		board = updateConflicts(parseBoard(puzzles[d]));
		selection = EMPTY_SELECTION;
		validationMessage = null;
		notesBoard = createEmptyNotesBoard();
		notesMode = false;
		screen = "playing";
	};

	const handleCellSelect = (row: number, col: number): void => {
		selection = setSelection(row, col);
	};

	const handleCellExtend = (row: number, col: number): void => {
		selection = extendSelection(selection, row, col);
	};

	const handleCellToggle = (row: number, col: number): void => {
		selection = toggleSelection(selection, row, col);
	};

	const handleKeyDown = (e: KeyboardEvent): void => {
		if (screen !== "playing") return;

		const key = e.key;

		// Escape: clear selection
		if (key === "Escape") {
			selection = clearSelection();
			return;
		}

		if (selection.focusCell === null) return;
		const [selectedRow, selectedCol] = selection.focusCell;

		// Shift+digit: toggle note regardless of notesMode
		if (e.shiftKey && key >= "1" && key <= "9") {
			const cell = board[selectedRow]?.[selectedCol];
			if (cell && !cell.isGiven && cell.value === 0) {
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

	const backToPicking = (): void => {
		screen = "picking";
		selection = EMPTY_SELECTION;
		validationMessage = null;
	};
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
	{:else if screen === "picking"}
		<div class="text-center space-y-6">
			<h1 class="text-3xl font-bold">Sudoku</h1>
			<p class="text-neutral-600 dark:text-neutral-400">
				Choose a difficulty
			</p>
			<div class="flex flex-col gap-3 justify-center">
				{#each ["simple", "easy", "intermediate", "expert"] as d (d)}
					<button
						class="w-full px-5 py-3 rounded-lg font-semibold capitalize bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
						onclick={() => selectDifficulty(d as Difficulty)}
					>
						{d}
					</button>
				{/each}
			</div>
		</div>
	{:else if screen === "playing"}
		<div class="flex flex-col items-center gap-4 w-full max-w-sm">
			<div class="flex items-center justify-between w-full">
				<button
					class="text-sm text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
					onclick={backToPicking}
				>
					← Back
				</button>
				<span
					class="text-sm font-medium capitalize text-neutral-600 dark:text-neutral-400"
					>{difficulty}</span
				>
			</div>
			<Grid
				{board}
				{selection}
				{notesBoard}
				{highlightDigit}
				onCellSelect={handleCellSelect}
				onCellExtend={handleCellExtend}
				onCellToggle={handleCellToggle}
				onDragEnd={() => {}}
			/>
			<NumberPad
				onNumber={handleNumber}
				onErase={handleErase}
				{notesMode}
				onToggleNotes={() => {
					notesMode = !notesMode;
				}}
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
				onclick={backToPicking}
			>
				Try another difficulty
			</button>
		</div>
	{/if}
</main>
