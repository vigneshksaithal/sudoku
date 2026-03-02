<script lang="ts">
	import Grid from "./components/Grid.svelte";
	import NumberPad from "./components/NumberPad.svelte";
	import {
		boardToString,
		isComplete,
		parseBoard,
		updateConflicts,
	} from "./lib/sudoku-utils";
	import type { CellState, Difficulty, GameScreen } from "./lib/types";

	let screen: GameScreen = $state("picking");
	let puzzles: Record<Difficulty, string> | null = $state(null);
	let difficulty: Difficulty = $state("easy");
	let board: CellState[][] = $state([]);
	let selectedRow: number | null = $state(null);
	let selectedCol: number | null = $state(null);
	let loading = $state(true);
	let error: string | null = $state(null);
	let validating = $state(false);
	let validationMessage: string | null = $state(null);

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
		selectedRow = null;
		selectedCol = null;
		validationMessage = null;
		screen = "playing";
	};

	const handleCellSelect = (row: number, col: number): void => {
		selectedRow = row;
		selectedCol = col;
	};

	const handleNumber = (num: number): void => {
		if (selectedRow === null || selectedCol === null) return;
		const cell = board[selectedRow]?.[selectedCol];
		if (!cell || cell.isGiven) return;
		board[selectedRow]![selectedCol] = { ...cell, value: num };
		board = updateConflicts(board);
		checkCompletion();
	};

	const handleErase = (): void => {
		if (selectedRow === null || selectedCol === null) return;
		const cell = board[selectedRow]?.[selectedCol];
		if (!cell || cell.isGiven) return;
		board[selectedRow]![selectedCol] = { ...cell, value: 0 };
		board = updateConflicts(board);
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
		selectedRow = null;
		selectedCol = null;
		validationMessage = null;
	};
</script>

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
			<div class="flex gap-3 justify-center">
				{#each ["easy", "medium", "hard"] as d (d)}
					<button
						class="px-5 py-3 rounded-lg font-semibold capitalize bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[44px] min-h-[44px]"
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
				{selectedRow}
				{selectedCol}
				onCellSelect={handleCellSelect}
			/>
			<NumberPad onNumber={handleNumber} onErase={handleErase} />
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
