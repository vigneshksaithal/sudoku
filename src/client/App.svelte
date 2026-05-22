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
		isMultiSelection,
		moveFocus,
		setSelection,
		toggleCellSelection,
	} from "./lib/selection-utils";
	import {
		applyAutoNotes,
		applyMultiErase,
		applyAutoCandidates,
		hasAutoCandidates,
		clearAutoCandidates,
		placeLockedDigit,
		batchPlaceDigit,
		isMistake,
	} from "./lib/app-logic";
	import {
		DIFFICULTY_STORAGE_KEY,
		VALID_DIFFICULTIES,
		getNextDifficulty,
	} from "./lib/constants";
	import {
		initialPauseState,
		reduce,
		type PauseEvent,
	} from "./lib/pause-reducer";
	import HintPanel from "./components/HintPanel.svelte";
	import Leaderboard from "./components/Leaderboard.svelte";
	import PauseOverlay from "./components/PauseOverlay.svelte";
	import SubmitPuzzle from "./components/SubmitPuzzle.svelte";
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
		PuzzleType,
		TechniqueHint,
	} from "./lib/types";

	const ARROW_MOVES: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
	};

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
	let mistakesCount: number = $state(0);
	let notesUsed: boolean = $state(false);
	let solveResult: {
		postRank: number;
		globalRank: number;
		adjustedTime: number;
	} | null = $state(null);
	let solveError: string | null = $state(null);
	let scoreCommentState: "idle" | "posting" | "success" | "error" =
		$state("idle");
	let scoreCommentError: string | null = $state(null);
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

	const autoCandidateActive = $derived(
		board.length > 0 && hasAutoCandidates(board, notesBoard),
	);

	const digitCounts: ReadonlyMap<number, number> = $derived(
		countDigitPlacements(board),
	);

	const solutionFlat: readonly number[] = $derived(
		solutions !== null ? Array.from(solutions[difficulty]).map(Number) : [],
	);

	let highlightDigit: number | null = $state(null);
	let lockedDigit: number | null = $state(null);
	let digitFirstMode: boolean = $state(false);
	let showLeaderboard: boolean = $state(false);
	let currentUsername: string | undefined = $state(undefined);
	let puzzleType: PuzzleType = $state("generated");
	let creatorUsername: string | null = $state(null);
	let solveCount: number | null = $state(null);
	let puzzleCreatedAt: number | null = $state(null);
	let pauseState = $state(initialPauseState);
	let pauseButtonEl: HTMLButtonElement | null = $state(null);

	const isPaused = $derived(pauseState.isPaused);
	const unrankedDueToBackground = $derived(
		pauseState.unrankedDueToBackground,
	);

	const dispatchPauseEvent = (event: PauseEvent): void => {
		pauseState = reduce(pauseState, event);
	};

	const resetRoundState = (): void => {
		selection = EMPTY_SELECTION;
		highlightDigit = null;
		validationMessage = null;
		notesBoard = createEmptyNotesBoard();
		notesMode = false;
		hintsUsed = 0;
		mistakesCount = 0;
		notesUsed = false;
		solveResult = null;
		solveError = null;
		scoreCommentState = "idle";
		scoreCommentError = null;
		activeHint = null;
		undoStack = clearStack();
		screen = "playing";
		lockedDigit = null;
		digitFirstMode = false;
		showLeaderboard = false;
		puzzleType = "generated";
		creatorUsername = null;
		solveCount = null;
		puzzleCreatedAt = null;
		dispatchPauseEvent("RESET_ROUND");
		startTimer();
	};

	const loadDifficultyBoard = (targetDifficulty: Difficulty): void => {
		if (puzzles === null) return;
		board = updateConflicts(parseBoard(puzzles[targetDifficulty]));
		resetRoundState();
	};

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
			if (json.data.type === "community") {
				puzzleType = "community";
				creatorUsername = json.data.creatorUsername ?? null;
				solveCount = json.data.solveCount ?? null;
				puzzleCreatedAt = json.data.createdAt ?? null;
				// For community puzzles, set difficulty to the single available key
				const keys = Object.keys(json.data.puzzles ?? {});
				const communityDifficulty = keys[0];
				if (communityDifficulty !== undefined) {
					difficulty = communityDifficulty as Difficulty;
				}
			} else {
				puzzleType = "generated";
				creatorUsername = null;
				solveCount = null;
				puzzleCreatedAt = json.data.createdAt ?? null;
			}
			if (puzzles) {
				loadDifficultyBoard(difficulty);
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
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener("pagehide", onPageHide);
		return () => {
			document.removeEventListener(
				"visibilitychange",
				onVisibilityChange,
			);
			window.removeEventListener("pagehide", onPageHide);
		};
	});

	const handlePause = (): void => {
		if (screen !== "playing" || isPaused) return;
		dispatchPauseEvent("PAUSE_PRESSED");
		if (timerInterval !== null) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

	const handleResume = (): void => {
		if (!isPaused) return;
		dispatchPauseEvent("RESUME");
		tickTimer();
		pauseButtonEl?.focus();
	};

	const handleRestartPuzzle = (): void => {
		if (puzzles === null) return;
		// Re-parse the original puzzle string — gives back a clean board with only givens
		board = updateConflicts(parseBoard(puzzles[difficulty]));
		// Reset all mutable game state (mirrors resetRoundState minus the timer zero)
		selection = EMPTY_SELECTION;
		highlightDigit = null;
		validationMessage = null;
		notesBoard = createEmptyNotesBoard();
		notesMode = false;
		hintsUsed = 0;
		mistakesCount = 0;
		notesUsed = false;
		activeHint = null;
		undoStack = clearStack();
		lockedDigit = null;
		digitFirstMode = false;
		// elapsedSeconds intentionally NOT touched — timer keeps running
		dispatchPauseEvent("RESET_ROUND"); // clears isPaused + unrankedDueToBackground
		tickTimer(); // resume ticking (was stopped while paused)
	};

	const onVisibilityChange = (): void => {
		if (screen !== "playing") return;
		if (document.hidden) {
			dispatchPauseEvent("VISIBILITY_HIDDEN");
			if (timerInterval !== null) {
				clearInterval(timerInterval);
				timerInterval = null;
			}
			return;
		}
		dispatchPauseEvent("VISIBILITY_SHOWN");
		if (!isPaused && timerInterval === null) tickTimer();
	};

	const onPageHide = (): void => {
		if (screen !== "playing") return;
		dispatchPauseEvent("PAGEHIDE");
		if (timerInterval !== null) {
			clearInterval(timerInterval);
			timerInterval = null;
		}
	};

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
		notesUsed = true;
		if (hasAutoCandidates(board, notesBoard)) {
			clearAutoCandidates(board, notesBoard);
		} else {
			applyAutoCandidates(board, notesBoard);
		}
	};

	const handleCellSelect = (row: number, col: number): void => {
		selection = setSelection(row, col);

		if (digitFirstMode && lockedDigit !== null) {
			const cell = board[row]?.[col];
			if (!cell || cell.isGiven) return;

			if (notesMode) {
				if (cell.value !== 0) return;
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				notesUsed = true;
				toggleNote(notesBoard, row, col, lockedDigit);
			} else {
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				if (
					placeLockedDigit(board, notesBoard, row, col, lockedDigit)
				) {
					if (isMistake(solutionFlat, row * 9 + col, lockedDigit)) {
						mistakesCount++;
					}
					board = updateConflicts(board);
					checkCompletion();
				}
			}
			return;
		}

		// No locked digit: highlight from cell value
		const cellValue = board[row]?.[col]?.value;
		if (cellValue !== undefined && cellValue > 0) {
			highlightDigit = cellValue;
		}
	};

	const handleDragSelect = (newSelection: Selection): void => {
		selection = newSelection;
	};

	const handleShiftCellSelect = (row: number, col: number): void => {
		selection = toggleCellSelection(selection, row, col);

		// In digit-first mode with a locked digit and multi-selection, batch-place
		if (
			digitFirstMode &&
			lockedDigit !== null &&
			isMultiSelection(selection)
		) {
			undoStack = pushSnapshot(
				undoStack,
				captureSnapshot(board, notesBoard, hintsUsed),
			);
			if (notesMode) {
				notesUsed = true;
				applyAutoNotes(board, notesBoard, selection, lockedDigit);
			} else {
				const placed = batchPlaceDigit(
					board,
					notesBoard,
					selection,
					lockedDigit,
				);
				for (const [r, c] of placed) {
					if (isMistake(solutionFlat, r * 9 + c, lockedDigit)) {
						mistakesCount++;
					}
				}
				board = updateConflicts(board);
				checkCompletion();
			}
		}
	};

	const handleKeyDown = (e: KeyboardEvent): void => {
		if ((e.ctrlKey || e.metaKey) && e.key === "z") {
			e.preventDefault();
			handleUndo();
			return;
		}
		if (isPaused && e.key !== "Escape") return;
		if (screen !== "playing") return;

		const key = e.key;

		// Escape: clear locked digit if set (digit-first mode), otherwise clear selection
		if (key === "Escape") {
			if (digitFirstMode && lockedDigit !== null) {
				lockedDigit = null;
				highlightDigit = null;
				return;
			}
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
				notesUsed = true;
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

			// With a locked digit in digit-first mode, auto-place into the newly focused cell
			if (
				digitFirstMode &&
				lockedDigit !== null &&
				selection.focusCell !== null
			) {
				const [newRow, newCol] = selection.focusCell;
				const cell = board[newRow]?.[newCol];
				if (cell && !cell.isGiven && cell.value === 0) {
					undoStack = pushSnapshot(
						undoStack,
						captureSnapshot(board, notesBoard, hintsUsed),
					);
					if (notesMode) {
						notesUsed = true;
						toggleNote(notesBoard, newRow, newCol, lockedDigit);
					} else {
						if (
							placeLockedDigit(
								board,
								notesBoard,
								newRow,
								newCol,
								lockedDigit,
							)
						) {
							if (
								isMistake(
									solutionFlat,
									newRow * 9 + newCol,
									lockedDigit,
								)
							) {
								mistakesCount++;
							}
							board = updateConflicts(board);
							checkCompletion();
						}
					}
				}
			}
		}
	};

	const handleNumber = (num: number): void => {
		if (digitFirstMode) {
			// Toggle locked digit: clear if same digit tapped again, otherwise lock
			lockedDigit = lockedDigit === num ? null : num;
			highlightDigit = lockedDigit;

			// Batch-place into multi-selection when locking a digit
			if (lockedDigit !== null && isMultiSelection(selection)) {
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				if (notesMode) {
					notesUsed = true;
					applyAutoNotes(board, notesBoard, selection, lockedDigit);
				} else {
					const placed = batchPlaceDigit(
						board,
						notesBoard,
						selection,
						lockedDigit,
					);
					for (const [r, c] of placed) {
						if (isMistake(solutionFlat, r * 9 + c, lockedDigit)) {
							mistakesCount++;
						}
					}
					board = updateConflicts(board);
					checkCompletion();
				}
			}
			return;
		}

		// Cell-first mode: place directly into focused cell
		highlightDigit = num;
		undoStack = pushSnapshot(
			undoStack,
			captureSnapshot(board, notesBoard, hintsUsed),
		);

		if (isMultiSelection(selection)) {
			notesUsed = true;
			applyAutoNotes(board, notesBoard, selection, num);
			return;
		}

		if (selection.focusCell === null) return;
		const [selectedRow, selectedCol] = selection.focusCell;
		const cell = board[selectedRow]?.[selectedCol];
		if (!cell || cell.isGiven) return;

		if (notesMode) {
			if (cell.value !== 0) return;
			notesUsed = true;
			toggleNote(notesBoard, selectedRow, selectedCol, num);
		} else {
			board[selectedRow]![selectedCol] = { ...cell, value: num };
			if (isMistake(solutionFlat, selectedRow * 9 + selectedCol, num)) {
				mistakesCount++;
			}
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
				if (timerInterval) clearInterval(timerInterval);
				screen = "completed";
				// Submit solve in the background — completion screen shows regardless
				try {
					const solveRes = await fetch("/api/solve", {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							difficulty,
							completionTime: elapsedSeconds,
							hintsUsed,
							mistakesCount,
							notesUsed,
							unranked: unrankedDueToBackground,
						}),
					});
					const solveJson = await solveRes.json();
					if (!solveRes.ok || solveJson.status === "error") {
						solveError =
							solveJson.message ?? "Failed to record solve.";
					} else {
						solveResult = solveJson.data;
					}
				} catch {
					solveError =
						"Could not submit solve. Check your connection.";
				}
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

	const handleScoreComment = async (): Promise<void> => {
		scoreCommentState = "posting";
		scoreCommentError = null;
		try {
			const res = await fetch("/api/score/comment", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					difficulty,
					completionTime: elapsedSeconds,
					hintsUsed,
					mistakesCount,
					notesUsed,
					unranked: unrankedDueToBackground,
				}),
			});
			const json = await res.json();
			if (!res.ok || json.status === "error") {
				throw new Error(
					json.message ?? "Failed to post score comment.",
				);
			}
			scoreCommentState = "success";
		} catch (e) {
			scoreCommentError =
				e instanceof Error
					? e.message
					: "Failed to post score comment.";
			scoreCommentState = "error";
		}
	};

	const changeDifficulty = (next: Difficulty): void => {
		if (next === difficulty || puzzles === null) return;
		try {
			localStorage.setItem(DIFFICULTY_STORAGE_KEY, next);
		} catch {
			// localStorage unavailable — preference not persisted
		}
		difficulty = next;
		loadDifficultyBoard(next);
	};

	let elapsedSeconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;

	// Starts the interval without zeroing elapsedSeconds — used by resume and
	// visibility-shown so the timer continues from its preserved value.
	const tickTimer = (): void => {
		if (timerInterval !== null) clearInterval(timerInterval);
		timerInterval = setInterval(() => elapsedSeconds++, 1000);
	};

	// Resets elapsedSeconds to 0 then starts the interval — used by resetRoundState.
	const startTimer = (): void => {
		elapsedSeconds = 0;
		tickTimer();
	};

	const formatTime = (s: number) => {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		return `${m}:${sec.toString().padStart(2, "0")}`;
	};

	const nextDifficulty = $derived(getNextDifficulty(difficulty));

	const puzzleTitle = $derived.by((): string => {
		if (puzzleCreatedAt === null || puzzleCreatedAt === 0) return "Sudoku";
		const d = new Date(puzzleCreatedAt);
		const dd = String(d.getDate()).padStart(2, "0");
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const yyyy = d.getFullYear();
		return `Sudoku #${dd}-${mm}-${yyyy}`;
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<main
	class="h-full w-full overflow-hidden bg-white text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100"
>
	{#if loading}
		<div class="flex h-full w-full items-center justify-center px-4">
			<p class="text-base">Loading puzzles…</p>
		</div>
	{:else if error}
		<div
			class="flex h-full w-full flex-col items-center justify-center gap-4 px-4 text-center"
		>
			<p class="text-red-600 dark:text-red-400">{error}</p>
			<button
				class="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
				onclick={() => fetchPuzzles()}
			>
				Retry
			</button>
		</div>
	{:else if screen === "playing"}
		<div
			class="mx-auto flex h-full w-full max-w-2xl flex-col gap-1 px-2 py-1 sm:max-w-4xl sm:gap-2 sm:py-2"
		>
			<div
				class="flex shrink-0 flex-wrap items-center justify-center gap-1 sm:gap-2"
			>
				{#if puzzleType === "community"}
					<span
						class="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium capitalize text-white sm:px-4 sm:py-1.5 sm:text-sm"
					>
						{difficulty}
					</span>
				{:else}
					{#each VALID_DIFFICULTIES as d (d)}
						<button
							class="rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 sm:px-4 sm:py-1.5 sm:text-sm
								{d === difficulty
								? 'bg-blue-600 text-white'
								: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'}"
							onclick={() => changeDifficulty(d)}
						>
							{d}
						</button>
					{/each}
				{/if}
			</div>
			{#if creatorUsername !== null || solveCount !== null}
				<div
					class="flex shrink-0 flex-wrap items-center justify-center gap-2 text-xs text-neutral-500 dark:text-neutral-400"
				>
					{#if creatorUsername !== null}
						<span>Submitted by u/{creatorUsername}</span>
					{/if}
					{#if solveCount !== null}
						<span>{solveCount} solves</span>
					{/if}
				</div>
			{/if}

			<div class="shrink-0 flex flex-col items-center gap-0.5">
				<p
					class="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
				>
					{puzzleTitle}
				</p>
				<div class="flex items-center gap-2">
					<p class="font-mono text-xs tabular-nums text-neutral-400">
						{formatTime(elapsedSeconds)}
					</p>
					<button
						class="flex items-center justify-center rounded-md min-h-11 min-w-11 bg-neutral-100 text-neutral-700 transition-all active:scale-95 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
						aria-label="Pause solve"
						bind:this={pauseButtonEl}
						onclick={handlePause}
						disabled={loading || error !== null || isPaused}
					>
						<span class="text-lg leading-none" aria-hidden="true"
							>⏸</span
						>
					</button>
				</div>
			</div>

			<div
				class="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-center"
			>
				<!-- Grid area: no flex-1 on mobile, grid is naturally sized -->
				<div
					class="relative flex shrink-0 flex-col items-center sm:w-3/5 sm:flex-initial sm:flex-1"
				>
					<div
						class="w-full"
						style="max-width: min(95vw, calc(100vh - 220px), 480px)"
					>
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
							onDragSelect={handleDragSelect}
							onShiftCellSelect={handleShiftCellSelect}
						/>
					</div>
					{#if isPaused}
						<PauseOverlay onResume={handleResume} onRestart={handleRestartPuzzle} />
					{/if}
					{#if activeHint !== null}
						<div class="hidden w-full sm:block">
							<HintPanel
								hint={activeHint}
								onApply={handleApplyHint}
								onDismiss={handleDismissHint}
							/>
						</div>
					{/if}
				</div>

				<!-- Controls area -->
				<div
					class="flex w-full shrink-0 flex-col gap-2 sm:w-2/5 sm:shrink-0"
				>
					{#if activeHint !== null}
						<div class="w-full sm:hidden">
							<HintPanel
								hint={activeHint}
								onApply={handleApplyHint}
								onDismiss={handleDismissHint}
							/>
						</div>
					{/if}
					{#if showLeaderboard}
						<!-- Desktop: inline leaderboard panel -->
						<div class="hidden sm:flex sm:flex-col sm:gap-2">
							<div class="flex items-center justify-between">
								<span
									class="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
									>Leaderboard</span
								>
								<button
									class="rounded-lg px-3 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
									onclick={() => (showLeaderboard = false)}
									aria-label="Close leaderboard"
								>
									✕ Close
								</button>
							</div>
							<div class="h-96">
								<Leaderboard
									{difficulty}
									{...currentUsername !== undefined
										? { currentUsername }
										: {}}
									mode="panel"
								/>
							</div>
						</div>
					{:else}
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
							{autoCandidateActive}
							{digitCounts}
							{lockedDigit}
							{digitFirstMode}
							onToggleDigitFirst={() => {
								digitFirstMode = !digitFirstMode;
								if (!digitFirstMode) lockedDigit = null;
							}}
							onLeaderboard={() =>
								(showLeaderboard = !showLeaderboard)}
							showLeaderboard={false}
							onSubmitPuzzle={() => (screen = "submit")}
							{isPaused}
						/>
					{/if}
					{#if validating}
						<p class="text-sm text-neutral-500">Checking…</p>
					{/if}
					{#if validationMessage}
						<p
							class="text-center text-sm text-red-600 dark:text-red-400"
						>
							{validationMessage}
						</p>
					{/if}
				</div>
			</div>
		</div>
		<!-- Mobile: full-screen leaderboard overlay -->
		{#if showLeaderboard}
			<div
				class="fixed inset-0 z-50 flex flex-col bg-white dark:bg-neutral-900 sm:hidden"
			>
				<div
					class="flex shrink-0 items-center justify-between px-4 py-3"
				>
					<span
						class="text-base font-semibold text-neutral-900 dark:text-neutral-100"
						>🏆 Leaderboard</span
					>
					<button
						class="min-h-11 min-w-11 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
						onclick={() => (showLeaderboard = false)}
						aria-label="Close leaderboard"
					>
						✕ Close
					</button>
				</div>
				<div class="min-h-0 flex-1 px-4 pb-4">
					<Leaderboard
						{difficulty}
						{...currentUsername !== undefined
							? { currentUsername }
							: {}}
						mode="panel"
					/>
				</div>
			</div>
		{/if}
	{:else if screen === "completed"}
		<div
			class="flex h-full w-full flex-col items-center overflow-y-auto px-4 py-4 text-center gap-3"
		>
			<h1 class="text-2xl font-bold shrink-0">🎉 Solved!</h1>
			<p class="text-sm text-neutral-600 dark:text-neutral-400 shrink-0">
				You completed the {difficulty} puzzle in
				<span
					class="font-mono font-semibold text-neutral-900 dark:text-neutral-100"
					>{formatTime(elapsedSeconds)}</span
				>.
			</p>
			{#if solveError !== null}
				<div
					class="flex shrink-0 items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-3 py-1.5 text-xs text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
				>
					<span>{solveError}</span>
					<button
						class="ml-1 text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-100 focus:outline-none"
						aria-label="Dismiss"
						onclick={() => (solveError = null)}
					>
						✕
					</button>
				</div>
			{/if}
			<div class="w-full max-w-md min-h-0 flex-1">
				<Leaderboard
					{difficulty}
					{...currentUsername !== undefined
						? { currentUsername }
						: {}}
					mode="completion"
					{solveResult}
				/>
			</div>
			<button
				class="min-h-11 shrink-0 rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white transition-all hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
				onclick={() => changeDifficulty(nextDifficulty)}
			>
				Try {nextDifficulty}
			</button>
			{#if scoreCommentState === "success"}
				<p
					class="shrink-0 text-sm font-semibold text-green-600 dark:text-green-400"
				>
					✓ Score posted!
				</p>
			{:else}
				{#if scoreCommentState === "error" && scoreCommentError !== null}
					<p class="shrink-0 text-xs text-red-600 dark:text-red-400">
						{scoreCommentError}
					</p>
				{/if}
				<button
					class="min-h-11 shrink-0 rounded-lg bg-neutral-100 px-5 py-2.5 font-semibold text-neutral-700 transition-all hover:bg-neutral-200 active:bg-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
					onclick={handleScoreComment}
					disabled={scoreCommentState === "posting"}
				>
					{scoreCommentState === "posting"
						? "Posting…"
						: "Comment My Score"}
				</button>
			{/if}
		</div>
	{:else if screen === "submit"}
		<SubmitPuzzle onClose={() => (screen = "playing")} />
	{/if}
</main>
