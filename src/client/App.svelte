<script lang="ts">
	import { connectRealtime } from "@devvit/web/client";
	import { onMount, untrack } from "svelte";
	import Grid from "./components/Grid.svelte";
	import HintPanel from "./components/HintPanel.svelte";
	import NumberPad from "./components/NumberPad.svelte";
	import {
		applyAutoCandidates,
		applyAutoNotes,
		applyMultiErase,
		batchPlaceDigit,
		clearAutoCandidates,
		hasAutoCandidates,
		placeLockedDigit,
	} from "./lib/app-logic";
	import { getDisplayDifficulty, getRankMovement, mergeRecentCompletions } from "./lib/community-ui";
	import {
		DIFFICULTY_STORAGE_KEY,
		VALID_DIFFICULTIES,
	} from "./lib/constants";
	import {
		cleanupNotes,
		clearCellNotes,
		createEmptyNotesBoard,
		toggleNote,
	} from "./lib/notes-utils";
	import type { Selection } from "./lib/selection-utils";
	import {
		EMPTY_SELECTION,
		clearSelection,
		isMultiSelection,
		moveFocus,
		setSelection,
		toggleCellSelection,
	} from "./lib/selection-utils";
	import {
		boardToString,
		countDigitPlacements,
		isComplete,
		parseBoard,
		updateConflicts,
	} from "./lib/sudoku-utils";
	import { buildCandidateBoard } from "./lib/technique-hints/candidate-board";
	import { findTechniqueHint } from "./lib/technique-hints/technique-engine";
	import type {
		CellState,
		Difficulty,
		GameScreen,
		NotesBoard,
		TechniqueHint,
	} from "./lib/types";
	import {
		captureSnapshot,
		clearStack,
		popSnapshot,
		pushSnapshot,
		restoreNotesBoard,
	} from "./lib/undo-stack";
	import type { UndoStack } from "./lib/undo-stack";
	import {
		DEFAULT_DAILY_GOALS,
		formatElapsedTime,
		formatScoreComment,
	} from "../shared/community";
	import type {
		CompletionResult,
		DailyGoalsState,
		FeaturedRaceMeta,
		LeaderboardEntry,
		PlayerProfile,
		PlayMode,
		RecentCompletionEvent,
	} from "../shared/community";

	type ApiSuccess<T> = {
		status: "success";
		data: T;
	};

	type ApiError = {
		status: "error";
		message: string;
	};

	type ApiResponse<T> = ApiSuccess<T> | ApiError;

	type BootstrapState = {
		postId: string;
		subredditName: string;
		channel: string;
		featuredRace: FeaturedRaceMeta;
		practicePuzzles: Record<Difficulty, string>;
		practiceSolutions: Record<Difficulty, string>;
		playerProfile: PlayerProfile;
		leaderboard: {
			entries: LeaderboardEntry[];
			currentUserRank: number | null;
		};
		recentCompletions: RecentCompletionEvent[];
	};

	type LeaderboardState = {
		entries: LeaderboardEntry[];
		currentUserRank: number | null;
		recentCompletions: RecentCompletionEvent[];
	};

	type CompletionResponse = {
		valid: boolean;
		completion?: CompletionResult;
	};

	type CommentScoreResponse = {
		commentId: string;
		target: "score-thread" | "post";
	};

	type SubscribeResponse = {
		subscribed: boolean;
	};

	type RealtimeMessage = {
		type: "completion";
		username: string;
		adjustedTime: number;
		rank: number | null;
		solverCount?: number;
	};

	type DailyGoalMeta = {
		id: keyof DailyGoalsState;
		label: string;
		description: string;
	};

	const ARROW_MOVES: Record<string, [number, number]> = {
		ArrowUp: [-1, 0],
		ArrowDown: [1, 0],
		ArrowLeft: [0, -1],
		ArrowRight: [0, 1],
	};

	const DAILY_GOAL_META: DailyGoalMeta[] = [
		{
			id: "featuredRace",
			label: "Finish today’s race",
			description: "Keep the community streak alive.",
		},
		{
			id: "hintFreeAny",
			label: "Solve any board hint-free",
			description: "Earn clean solver progress.",
		},
		{
			id: "beatPersonalBest",
			label: "Beat a personal best",
			description: "Improve on any difficulty.",
		},
	];

	const formatDifficulty = (value: Difficulty): string =>
		`${value[0]?.toUpperCase() ?? ""}${value.slice(1)}`;

	const getErrorMessage = (error: unknown): string =>
		error instanceof Error ? error.message : "Something went wrong.";

	const parseApiResponse = async <T>(
		response: Response,
	): Promise<T> => {
		const payload = (await response.json()) as ApiResponse<T>;
		if (!response.ok || payload.status !== "success") {
			throw new Error(
				payload.status === "error"
					? payload.message
					: "Unexpected response.",
			);
		}

		return payload.data;
	};

	let { difficulty: initialDifficulty }: { difficulty: Difficulty } =
		$props();

	let screen: GameScreen = $state("playing");
	let playMode: PlayMode = $state("featured");
	let practiceDifficulty: Difficulty = $state(untrack(() => initialDifficulty));
	let featuredRace = $state<FeaturedRaceMeta | null>(null);
	let practicePuzzles: Record<Difficulty, string> | null = $state(null);
	let practiceSolutions: Record<Difficulty, string> | null = $state(null);
	let board: CellState[][] = $state([]);
	let selection: Selection = $state(EMPTY_SELECTION);
	let loading = $state(true);
	let error: string | null = $state(null);
	let subredditName = $state("");
	let validating = $state(false);
	let validationMessage: string | null = $state(null);
	let validationFailures: number = $state(0);
	let notesMode = $state(false);
	let notesBoard: NotesBoard = $state(createEmptyNotesBoard());
	let hintsUsed: number = $state(0);
	let activeHint: TechniqueHint | null = $state(null);
	let undoStack: UndoStack = $state([]);
	let highlightDigit: number | null = $state(null);
	let lockedDigit: number | null = $state(null);
	let digitFirstMode: boolean = $state(false);
	let isPaused: boolean = $state(false);
	let timerVisible: boolean = $state(true);
	let elapsedSeconds = $state(0);
	let timerInterval: ReturnType<typeof setInterval> | null = null;
	let playerProfile = $state<PlayerProfile | null>(null);
	let leaderboardEntries: LeaderboardEntry[] = $state([]);
	let currentUserRank: number | null = $state(null);
	let recentCompletions: RecentCompletionEvent[] = $state([]);
	let completionResult = $state<CompletionResult | null>(null);
	let scoreComposerOpen = $state(false);
	let scoreCommentNote = $state("");
	let scoreCommentStatus: string | null = $state(null);
	let commentingScore = $state(false);
	let subscribeStatus: string | null = $state(null);
	let joiningSubreddit = $state(false);
	let leaderboardPanel: HTMLElement | undefined = $state();
	let realtimeConnection:
		| {
				disconnect?: () => Promise<void>;
		  }
		| null = null;

	const featuredDifficulty = $derived(
		featuredRace?.difficulty ?? practiceDifficulty,
	);
	const activeDifficulty = $derived(
		getDisplayDifficulty(
			playMode,
			practiceDifficulty,
			featuredDifficulty,
		),
	);
	const hintsDisabled = $derived(
		screen !== "playing" ||
			practiceSolutions === null ||
			activeHint !== null ||
			isPaused,
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
		undoStack.length === 0 || screen !== "playing" || isPaused,
	);
	const autoCandidateActive = $derived(
		board.length > 0 && hasAutoCandidates(board, notesBoard),
	);
	const digitCounts: ReadonlyMap<number, number> = $derived(
		countDigitPlacements(board),
	);
	const activeRank = $derived(
		completionResult !== null && completionResult.rank > 0
			? completionResult.rank
			: currentUserRank,
	);
	const rankMovement = $derived(
		completionResult === null
			? null
			: getRankMovement(
					completionResult.previousRank,
					completionResult.rank > 0 ? completionResult.rank : null,
				),
	);
	const commentPreview = $derived.by(() => {
		const result = completionResult;
		if (result === null) return "";
		return formatScoreComment({
			difficulty: activeDifficulty,
			mode: playMode,
			elapsedSeconds,
			adjustedTime: result.adjustedTime,
			hintsUsed,
			validationFailures,
			rank: result.rank > 0 ? result.rank : null,
			...(scoreCommentNote.trim().length > 0
				? { note: scoreCommentNote.trim() }
				: {}),
		});
	});
	const goalState = $derived(
		playerProfile?.dailyGoals ?? DEFAULT_DAILY_GOALS,
	);
	const boardEyebrow = $derived(
		playMode === "featured"
			? `Today’s Race • ${formatDifficulty(activeDifficulty)}`
			: `Practice Lab • ${formatDifficulty(practiceDifficulty)}`,
	);
	const boardTitle = $derived(
		playMode === "featured"
			? featuredRace?.title ?? "Sudoku Daily Race"
			: `${formatDifficulty(practiceDifficulty)} Practice`,
	);
	const boardSubtitle = $derived(
		playMode === "featured"
			? `${featuredRace?.solverCount ?? 0} solvers have already entered today’s board.`
			: "Warm up, chase a cleaner solve, then jump back into the shared race.",
	);
	const badgeList = $derived(playerProfile?.badges ?? []);

	const startTimer = (): void => {
		elapsedSeconds = 0;
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
	};

	const stopTimer = (): void => {
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = null;
	};

	const formatTimer = (seconds: number): string => {
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const resetRoundState = (): void => {
		stopTimer();
		isPaused = false;
		timerVisible = true;
		selection = EMPTY_SELECTION;
		highlightDigit = null;
		validationMessage = null;
		validationFailures = 0;
		notesBoard = createEmptyNotesBoard();
		notesMode = false;
		hintsUsed = 0;
		activeHint = null;
		undoStack = clearStack();
		screen = "playing";
		lockedDigit = null;
		digitFirstMode = false;
		completionResult = null;
		scoreComposerOpen = false;
		scoreCommentNote = "";
		scoreCommentStatus = null;
		subscribeStatus = null;
		startTimer();
	};

	const getBoardString = (
		mode: PlayMode,
		targetDifficulty: Difficulty,
	): string | null => {
		if (mode === "featured") {
			return featuredRace?.puzzle ?? null;
		}

		return practicePuzzles?.[targetDifficulty] ?? null;
	};

	const updateLocalProfileFromCompletion = (
		result: CompletionResult,
		mode: PlayMode,
		difficulty: Difficulty,
	): void => {
		if (playerProfile === null) return;

		const earnedFeaturedCompletion =
			mode === "featured" && !playerProfile.dailyGoals.featuredRace;
		const earnedHintFree = hintsUsed === 0 ? 1 : 0;

		playerProfile = {
			...playerProfile,
			currentStreak: result.currentStreak,
			longestStreak: result.longestStreak,
			freezeCount: result.freezeCount,
			totalCompletions: playerProfile.totalCompletions + 1,
			totalFeaturedCompletions:
				playerProfile.totalFeaturedCompletions +
				(earnedFeaturedCompletion ? 1 : 0),
			hintFreeCompletions:
				playerProfile.hintFreeCompletions + earnedHintFree,
			bestTimes: {
				...playerProfile.bestTimes,
				[difficulty]: result.personalBest,
			},
			dailyGoals: result.dailyGoals,
			badges: result.badges ?? playerProfile.badges,
		};
	};

	const hydrateBootstrapState = (data: BootstrapState): void => {
		featuredRace = data.featuredRace;
		practicePuzzles = data.practicePuzzles;
		practiceSolutions = data.practiceSolutions;
		playerProfile = data.playerProfile;
		leaderboardEntries = data.leaderboard.entries;
		currentUserRank = data.leaderboard.currentUserRank;
		recentCompletions = data.recentCompletions;
		subredditName = data.subredditName;
		board = updateConflicts(parseBoard(data.featuredRace.puzzle));
		playMode = "featured";
		resetRoundState();
	};

	const fetchBootstrap = async (): Promise<string> => {
		const data = await parseApiResponse<BootstrapState>(
			await fetch("/api/bootstrap"),
		);
		hydrateBootstrapState(data);
		return data.channel;
	};

	const refreshLeaderboard = async (): Promise<void> => {
		try {
			const data = await parseApiResponse<LeaderboardState>(
				await fetch("/api/leaderboard"),
			);
			leaderboardEntries = data.entries;
			currentUserRank = data.currentUserRank;
			recentCompletions = data.recentCompletions;
		} catch {
			// Keep the current client state if a refresh fails.
		}
	};

	const loadBoardForMode = (
		mode: PlayMode,
		targetDifficulty = practiceDifficulty,
	): void => {
		const nextBoardString = getBoardString(mode, targetDifficulty);
		if (nextBoardString === null) return;

		if (mode === "practice") {
			practiceDifficulty = targetDifficulty;
		}

		playMode = mode;
		board = updateConflicts(parseBoard(nextBoardString));
		resetRoundState();
	};

	const handleToggleTimer = (): void => {
		timerVisible = !timerVisible;
	};

	const handlePause = (): void => {
		if (screen !== "playing") return;
		isPaused = true;
		stopTimer();
	};

	const handleResume = (): void => {
		if (screen !== "playing") return;
		isPaused = false;
		if (timerInterval) clearInterval(timerInterval);
		timerInterval = setInterval(() => {
			elapsedSeconds += 1;
		}, 1000);
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
		if (screen !== "playing" || isPaused) return;
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

	const handleToggleNotesMode = (): void => {
		if (screen !== "playing" || isPaused) return;
		notesMode = !notesMode;
	};

	const handleToggleDigitFirstMode = (): void => {
		if (screen !== "playing" || isPaused) return;
		digitFirstMode = !digitFirstMode;
		if (!digitFirstMode) {
			lockedDigit = null;
			highlightDigit = null;
		}
	};

	const handleCellSelect = (row: number, col: number): void => {
		if (isPaused || screen !== "playing") return;
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
				toggleNote(notesBoard, row, col, lockedDigit);
			} else {
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				if (
					placeLockedDigit(board, notesBoard, row, col, lockedDigit)
				) {
					board = updateConflicts(board);
					void checkCompletion();
				}
			}
			return;
		}

		const cellValue = board[row]?.[col]?.value;
		if (cellValue !== undefined && cellValue > 0) {
			highlightDigit = cellValue;
		}
	};

	const handleDragSelect = (newSelection: Selection): void => {
		if (isPaused || screen !== "playing") return;
		selection = newSelection;
	};

	const handleShiftCellSelect = (row: number, col: number): void => {
		if (isPaused || screen !== "playing") return;
		selection = toggleCellSelection(selection, row, col);

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
				applyAutoNotes(board, notesBoard, selection, lockedDigit);
			} else {
				batchPlaceDigit(board, notesBoard, selection, lockedDigit);
				board = updateConflicts(board);
				void checkCompletion();
			}
		}
	};

	const handleNumber = (num: number): void => {
		if (screen !== "playing" || isPaused) return;
		if (digitFirstMode) {
			lockedDigit = lockedDigit === num ? null : num;
			highlightDigit = lockedDigit;

			if (lockedDigit !== null && isMultiSelection(selection)) {
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				if (notesMode) {
					applyAutoNotes(board, notesBoard, selection, lockedDigit);
				} else {
					batchPlaceDigit(board, notesBoard, selection, lockedDigit);
					board = updateConflicts(board);
					void checkCompletion();
				}
			}
			return;
		}

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
			if (cell.value !== 0) return;
			toggleNote(notesBoard, selectedRow, selectedCol, num);
		} else {
			board[selectedRow]![selectedCol] = { ...cell, value: num };
			board = updateConflicts(board);
			clearCellNotes(notesBoard, selectedRow, selectedCol);
			cleanupNotes(notesBoard, selectedRow, selectedCol, num);
			void checkCompletion();
		}
	};

	const handleErase = (): void => {
		if (screen !== "playing" || isPaused) return;
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
			clearCellNotes(notesBoard, selectedRow, selectedCol);
		} else {
			board[selectedRow]![selectedCol] = { ...cell, value: 0 };
			board = updateConflicts(board);
		}
	};

	const handleHint = (): void => {
		if (practiceSolutions === null || activeHint !== null || isPaused) return;
		const solutionStr = practiceSolutions[activeDifficulty];
		if (!solutionStr) return;
		const solutionFlat = Array.from(solutionStr).map(Number);
		const candidates = buildCandidateBoard(board, notesBoard);
		const hint = findTechniqueHint(board, candidates, solutionFlat);
		if (hint === null) return;
		activeHint = hint;
		hintsUsed += 1;
	};

	const handleApplyHint = (): void => {
		if (activeHint === null || isPaused) return;
		undoStack = pushSnapshot(
			undoStack,
			captureSnapshot(board, notesBoard, hintsUsed),
		);
		if (activeHint.action === "placement") {
			const [row, col] = activeHint.primaryCells[0]!;
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
			for (const elimination of activeHint.eliminations ?? []) {
				for (const digit of elimination.digits) {
					notesBoard[elimination.row]?.[elimination.col]?.delete(digit);
				}
			}
		}
		board = updateConflicts(board);
		activeHint = null;
		void checkCompletion();
	};

	const handleDismissHint = (): void => {
		activeHint = null;
	};

	const changeDifficulty = (next: Difficulty): void => {
		if (next === practiceDifficulty || practicePuzzles === null) return;
		try {
			localStorage.setItem(DIFFICULTY_STORAGE_KEY, next);
		} catch {
			// localStorage is optional in this webview.
		}

		practiceDifficulty = next;
		if (playMode === "practice") {
			loadBoardForMode("practice", next);
		}
	};

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (isPaused) return;
		if ((event.ctrlKey || event.metaKey) && event.key === "z") {
			event.preventDefault();
			handleUndo();
			return;
		}
		if (screen !== "playing") return;

		if (event.key === "Escape") {
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

		if (event.shiftKey && event.key >= "1" && event.key <= "9") {
			const cell = board[selectedRow]?.[selectedCol];
			if (cell && !cell.isGiven && cell.value === 0) {
				undoStack = pushSnapshot(
					undoStack,
					captureSnapshot(board, notesBoard, hintsUsed),
				);
				toggleNote(
					notesBoard,
					selectedRow,
					selectedCol,
					parseInt(event.key),
				);
			}
			return;
		}

		if (event.key >= "1" && event.key <= "9") {
			handleNumber(parseInt(event.key));
			return;
		}

		if (
			event.key === "Backspace" ||
			event.key === "Delete" ||
			event.key === "0"
		) {
			event.preventDefault();
			handleErase();
			return;
		}

		const move = ARROW_MOVES[event.key];
		if (!move) return;

		event.preventDefault();
		const [dr, dc] = move;
		selection = moveFocus(selection.focusCell, dr, dc);

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
					toggleNote(notesBoard, newRow, newCol, lockedDigit);
				} else if (
					placeLockedDigit(
						board,
						notesBoard,
						newRow,
						newCol,
						lockedDigit,
					)
				) {
					board = updateConflicts(board);
					void checkCompletion();
				}
			}
		}
	};

	const checkCompletion = async (): Promise<void> => {
		if (!isComplete(board)) return;
		validating = true;
		validationMessage = null;

		try {
			const data = await parseApiResponse<CompletionResponse>(
				await fetch("/api/complete", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						board: boardToString(board),
						difficulty: activeDifficulty,
						elapsedSeconds,
						hintsUsed,
						validationFailures,
						mode: playMode,
					}),
				}),
			);

			if (!data.valid || data.completion === undefined) {
				validationFailures += 1;
				validationMessage =
					"Not quite right — check your solution and try again.";
				return;
			}

			stopTimer();
			isPaused = false;
			completionResult = data.completion;
			screen = "completed";
			if (data.completion.leaderboardEntries !== undefined) {
				leaderboardEntries = data.completion.leaderboardEntries;
			}
			if (data.completion.recentCompletions !== undefined) {
				recentCompletions = data.completion.recentCompletions;
			}
			if (data.completion.rank > 0) {
				currentUserRank = data.completion.rank;
			}
			updateLocalProfileFromCompletion(
				data.completion,
				playMode,
				activeDifficulty,
			);
		} catch (caughtError) {
			validationMessage = getErrorMessage(caughtError);
		} finally {
			validating = false;
		}
	};

	const handleRealtimeMessage = (message: RealtimeMessage): void => {
		if (message.type !== "completion") return;

		recentCompletions = mergeRecentCompletions(
			recentCompletions,
			{
				username: message.username,
				adjustedTime: message.adjustedTime,
				difficulty: featuredDifficulty,
			},
			new Date().toISOString(),
		);

		if (featuredRace !== null && message.solverCount !== undefined) {
			featuredRace = {
				...featuredRace,
				solverCount: message.solverCount,
			};
		}

		void refreshLeaderboard();
	};

	const handlePlayAgain = (): void => {
		loadBoardForMode(playMode, practiceDifficulty);
	};

	const handleOpenScoreComposer = (): void => {
		scoreComposerOpen = true;
		scoreCommentStatus = null;
	};

	const handleCommentScore = async (): Promise<void> => {
		if (completionResult === null) return;
		commentingScore = true;
		scoreCommentStatus = null;

		try {
			const data = await parseApiResponse<CommentScoreResponse>(
				await fetch("/api/comment-score", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						difficulty: activeDifficulty,
						mode: playMode,
						elapsedSeconds,
						adjustedTime: completionResult.adjustedTime,
						hintsUsed,
						validationFailures,
						...(completionResult.rank > 0
							? { rank: completionResult.rank }
							: {}),
						...(scoreCommentNote.trim().length > 0
							? { note: scoreCommentNote.trim() }
							: {}),
					}),
				}),
			);
			scoreCommentStatus =
				data.target === "post"
					? "Posted your score as a top-level comment."
					: "Replied inside the official score thread.";
			scoreComposerOpen = false;
		} catch (caughtError) {
			scoreCommentStatus = getErrorMessage(caughtError);
		} finally {
			commentingScore = false;
		}
	};

	const handleJoinSubreddit = async (): Promise<void> => {
		joiningSubreddit = true;
		subscribeStatus = null;

		try {
			const data = await parseApiResponse<SubscribeResponse>(
				await fetch("/api/subscribe", {
					method: "POST",
				}),
			);
			subscribeStatus = data.subscribed
				? `Joined r/${subredditName}.`
				: "Could not join this subreddit.";
		} catch (caughtError) {
			subscribeStatus = getErrorMessage(caughtError);
		} finally {
			joiningSubreddit = false;
		}
	};

	const handleViewLeaderboard = (): void => {
		leaderboardPanel?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	};

	onMount(() => {
		let disposed = false;

		void (async () => {
			try {
				const channel = await fetchBootstrap();
				if (disposed) return;

				realtimeConnection = connectRealtime<RealtimeMessage>({
					channel,
					onMessage: handleRealtimeMessage,
				});
			} catch (caughtError) {
				if (disposed) return;
				error = getErrorMessage(caughtError);
			} finally {
				if (!disposed) {
					loading = false;
				}
			}
		})();

		return () => {
			disposed = true;
			stopTimer();
			const connection = realtimeConnection;
			realtimeConnection = null;
			if (connection?.disconnect) {
				void connection.disconnect();
			}
		};
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

<main
	class="h-full w-full overflow-auto bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.16),transparent_36%),linear-gradient(180deg,_#f8fafc,_#eff6ff_48%,_#ecfccb)] text-slate-950"
>
	{#if loading}
		<div class="flex min-h-full items-center justify-center px-4 py-8">
			<div class="rounded-[28px] border border-white/60 bg-white/80 px-6 py-5 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
				<p class="font-mono text-sm uppercase tracking-[0.28em] text-teal-700">
					Booting Today’s Race
				</p>
				<p class="mt-3 text-base text-slate-600">
					Loading the live board, leaderboard, and streak state.
				</p>
			</div>
		</div>
	{:else if error}
		<div class="flex min-h-full items-center justify-center px-4 py-8">
			<div class="max-w-md rounded-[28px] border border-red-200 bg-white/85 p-6 text-center shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur">
				<p class="font-mono text-sm uppercase tracking-[0.28em] text-red-600">
					Launch Problem
				</p>
				<h1 class="mt-3 font-serif text-3xl tracking-[-0.04em] text-slate-950">
					The race didn’t load
				</h1>
				<p class="mt-3 text-sm leading-6 text-slate-600">{error}</p>
				<button
					class="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
					onclick={() => window.location.reload()}
				>
					Reload the board
				</button>
			</div>
		</div>
	{:else if screen === "playing"}
		<div class="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
			<section
				class="overflow-hidden rounded-[32px] border border-white/70 bg-white/78 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6"
			>
				<div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
					<div class="max-w-3xl">
						<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
							Reddit-Native Community Game
						</p>
						<h1 class="mt-3 font-serif text-4xl tracking-[-0.06em] text-slate-950 sm:text-5xl">
							{featuredRace?.title ?? "Sudoku Daily Race"}
						</h1>
						<p class="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
							One shared featured board drives the leaderboard. Practice is still open, but the daily race is the habit loop that grows the thread.
						</p>
					</div>
					<div class="flex flex-wrap gap-3">
						<button
							class={[
								"min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition",
								playMode === "featured"
									? "bg-slate-950 text-white shadow-lg shadow-slate-950/15"
									: "bg-slate-100 text-slate-700 hover:bg-slate-200",
							]}
							onclick={() => loadBoardForMode("featured")}
						>
							Play Today’s Race
						</button>
						<button
							class={[
								"min-h-11 rounded-full px-4 py-2 text-sm font-semibold transition",
								playMode === "practice"
									? "bg-teal-700 text-white shadow-lg shadow-teal-700/15"
									: "bg-teal-50 text-teal-800 hover:bg-teal-100",
							]}
							onclick={() => loadBoardForMode("practice", practiceDifficulty)}
						>
							Practice Lab
						</button>
					</div>
				</div>

				<div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Featured Difficulty
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{formatDifficulty(featuredDifficulty)}
						</p>
						<p class="mt-1 text-sm text-slate-600">
							The only board that moves the public race.
						</p>
					</div>
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Live Solvers
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{featuredRace?.solverCount ?? 0}
						</p>
						<p class="mt-1 text-sm text-slate-600">
							Visible social proof for every post impression.
						</p>
					</div>
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Current Streak
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{playerProfile?.currentStreak ?? 0} days
						</p>
						<p class="mt-1 text-sm text-slate-600">
							{playerProfile?.freezeCount ?? 0} freeze{(playerProfile?.freezeCount ?? 0) === 1
								? ""
								: "s"} banked
						</p>
					</div>
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Your Rank
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{activeRank === null ? "Unranked" : `#${activeRank}`}
						</p>
						<p class="mt-1 text-sm text-slate-600">
							Featured solves update live in the thread.
						</p>
					</div>
				</div>

				{#if badgeList.length > 0}
					<div class="mt-4 flex flex-wrap gap-2">
						{#each badgeList as badge (badge)}
							<span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
								{badge}
							</span>
						{/each}
					</div>
				{/if}
			</section>

			<div class="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
				<section
					class="rounded-[32px] border border-white/70 bg-white/82 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6"
				>
					<div class="flex flex-col gap-4">
						<div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
							<div>
								<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
									{boardEyebrow}
								</p>
								<h2 class="mt-2 font-serif text-3xl tracking-[-0.05em] text-slate-950">
									{boardTitle}
								</h2>
								<p class="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
									{boardSubtitle}
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-2">
								<div class="rounded-full bg-slate-950 px-4 py-2 font-mono text-sm font-semibold text-white">
									{timerVisible ? formatTimer(elapsedSeconds) : "Timer hidden"}
								</div>
								<button
									class="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									onclick={handleToggleTimer}
								>
									{timerVisible ? "Hide Timer" : "Show Timer"}
								</button>
								<button
									class="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
									onclick={isPaused ? handleResume : handlePause}
								>
									{isPaused ? "Resume" : "Pause"}
								</button>
							</div>
						</div>

						{#if playMode === "practice"}
							<div class="flex flex-wrap gap-2">
								{#each VALID_DIFFICULTIES as difficultyOption (difficultyOption)}
									<button
										class={[
											"rounded-full px-3 py-1.5 text-sm font-semibold transition",
											difficultyOption === practiceDifficulty
												? "bg-teal-700 text-white"
												: "bg-teal-50 text-teal-800 hover:bg-teal-100",
										]}
										onclick={() => changeDifficulty(difficultyOption)}
									>
										{formatDifficulty(difficultyOption)}
									</button>
								{/each}
							</div>
						{/if}

						<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
							<div class="space-y-3">
								<div class="relative mx-auto w-full max-w-[min(95vw,560px)]">
									<div class="overflow-hidden rounded-[28px] border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.10)]">
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
										<div class="absolute inset-0 flex items-center justify-center rounded-[28px] bg-slate-950/65 backdrop-blur-sm">
											<div class="rounded-[24px] bg-white/90 px-5 py-4 text-center shadow-2xl">
												<p class="font-mono text-xs uppercase tracking-[0.24em] text-teal-700">
													Paused
												</p>
												<p class="mt-2 text-sm text-slate-600">
													Your timer is frozen. Resume when you’re ready to rejoin the race.
												</p>
												<button
													class="mt-4 min-h-11 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
													onclick={handleResume}
												>
													Resume Solve
												</button>
											</div>
										</div>
									{/if}
								</div>

								{#if activeHint !== null}
									<HintPanel
										hint={activeHint}
										onApply={handleApplyHint}
										onDismiss={handleDismissHint}
									/>
								{/if}

								{#if validationMessage}
									<p class="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
										{validationMessage}
									</p>
								{/if}
							</div>

							<div class="space-y-3">
								<div class="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
									<NumberPad
										onNumber={handleNumber}
										onErase={handleErase}
										{notesMode}
										onToggleNotes={handleToggleNotesMode}
										onHint={handleHint}
										{hintsDisabled}
										onUndo={handleUndo}
										{undoDisabled}
										onAutoCandidate={handleAutoCandidate}
										{autoCandidateActive}
										{digitCounts}
										{lockedDigit}
										{digitFirstMode}
										onToggleDigitFirst={handleToggleDigitFirstMode}
									/>
								</div>

								<div class="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
									<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
										Current Run
									</p>
									<div class="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
										<div>
											<p class="text-xs uppercase tracking-[0.18em] text-slate-400">
												Mode
											</p>
											<p class="mt-1 text-sm font-semibold text-slate-900">
												{playMode === "featured"
													? "Featured Race"
													: "Practice"}
											</p>
										</div>
										<div>
											<p class="text-xs uppercase tracking-[0.18em] text-slate-400">
												Hints Used
											</p>
											<p class="mt-1 text-sm font-semibold text-slate-900">
												{hintsUsed}
											</p>
										</div>
										<div>
											<p class="text-xs uppercase tracking-[0.18em] text-slate-400">
												Validation Misses
											</p>
											<p class="mt-1 text-sm font-semibold text-slate-900">
												{validationFailures}
											</p>
										</div>
									</div>
									{#if validating}
										<p class="mt-3 text-sm text-slate-500">
											Checking your board and updating the live race…
										</p>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</section>

				<aside class="space-y-4">
					<section
						bind:this={leaderboardPanel}
						class="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur"
					>
						<div class="flex items-end justify-between gap-3">
							<div>
								<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
									Leaderboard
								</p>
								<h2 class="mt-2 font-serif text-3xl tracking-[-0.05em] text-slate-950">
									Today’s Top Solvers
								</h2>
							</div>
							{#if activeRank !== null}
								<div class="rounded-full bg-slate-950 px-3 py-1 font-mono text-xs font-semibold text-white">
									You: #{activeRank}
								</div>
							{/if}
						</div>

						<div class="mt-4 space-y-3">
							{#if leaderboardEntries.length === 0}
								<p class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
									No public solves yet. You can be the first name this thread sees.
								</p>
							{:else}
								{#each leaderboardEntries.slice(0, 5) as entry (entry.userId)}
									<div class="flex items-center justify-between rounded-[22px] bg-slate-50 px-4 py-3">
										<div class="flex items-center gap-3">
											<div class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 font-mono text-xs font-semibold text-white">
												#{entry.rank}
											</div>
											<div>
												<p class="text-sm font-semibold text-slate-950">
													{entry.username}
												</p>
												<p class="text-xs uppercase tracking-[0.18em] text-slate-400">
													{formatDifficulty(entry.difficulty)}
												</p>
											</div>
										</div>
										<div class="text-right">
											<p class="font-mono text-sm font-semibold text-teal-700">
												{formatElapsedTime(entry.adjustedTime)}
											</p>
											<p class="text-xs text-slate-500">
												raw {formatElapsedTime(entry.elapsedSeconds)}
											</p>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					</section>

					<section
						class="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur"
					>
						<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
							Live Feed
						</p>
						<h2 class="mt-2 font-serif text-3xl tracking-[-0.05em] text-slate-950">
							Community Energy
						</h2>
						<div class="mt-4 space-y-3">
							{#if recentCompletions.length === 0}
								<p class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
									The feed wakes up as soon as players start finishing the featured board.
								</p>
							{:else}
								{#each recentCompletions.slice(0, 5) as event (`${event.username}-${event.completedAtIso}`)}
									<div class="rounded-[22px] bg-slate-50 px-4 py-3">
										<p class="text-sm font-semibold text-slate-950">
											{event.username} just finished in {formatElapsedTime(event.adjustedTime)}
										</p>
										<p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
											{formatDifficulty(event.difficulty)} solve
										</p>
									</div>
								{/each}
							{/if}
						</div>
					</section>

					<section
						class="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur"
					>
						<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
							Daily Goals
						</p>
						<h2 class="mt-2 font-serif text-3xl tracking-[-0.05em] text-slate-950">
							Investment Loop
						</h2>
						<div class="mt-4 space-y-3">
							{#each DAILY_GOAL_META as goal (goal.id)}
								<div class="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
									<div class="flex items-start justify-between gap-3">
										<div>
											<p class="text-sm font-semibold text-slate-950">
												{goal.label}
											</p>
											<p class="mt-1 text-sm text-slate-600">
												{goal.description}
											</p>
										</div>
										<span
											class={[
												"rounded-full px-3 py-1 text-xs font-semibold",
												goalState[goal.id]
													? "bg-emerald-100 text-emerald-700"
													: "bg-slate-200 text-slate-600",
											]}
										>
											{goalState[goal.id] ? "Done" : "Open"}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</section>
				</aside>
			</div>
		</div>
	{:else}
		<div class="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
			<section
				class="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur sm:p-6"
			>
				<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
					Completion Summary
				</p>
				<h1 class="mt-3 font-serif text-4xl tracking-[-0.06em] text-slate-950 sm:text-5xl">
					{playMode === "featured" ? "Race complete" : "Practice solved"}
				</h1>
				<p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
					Your solve now feeds streaks, daily goals, and public community proof. The next step is yours to choose.
				</p>

				<div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Adjusted Time
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{completionResult ? formatElapsedTime(completionResult.adjustedTime) : "0:00"}
						</p>
						<p class="mt-1 text-sm text-slate-600">
							Raw {formatTimer(elapsedSeconds)} • {hintsUsed} hint{hintsUsed === 1 ? "" : "s"}
						</p>
					</div>
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Streak
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{completionResult?.currentStreak ?? 0} days
						</p>
						<p class="mt-1 text-sm text-slate-600">
							{completionResult?.freezeCount ?? 0} freeze{(completionResult?.freezeCount ?? 0) === 1
								? ""
								: "s"} ready
						</p>
					</div>
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Leaderboard Move
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{#if completionResult?.rank && completionResult.rank > 0}
								#{completionResult.rank}
							{:else}
								Practice
							{/if}
						</p>
						<p class="mt-1 text-sm text-slate-600">
							{#if rankMovement === null}
								Rank updates after your first featured solve.
							{:else if rankMovement > 0}
								You climbed {rankMovement} spot{rankMovement === 1 ? "" : "s"}.
							{:else if rankMovement === 0}
								You defended your leaderboard position.
							{:else}
								The board updated, but your rank held lower.
							{/if}
						</p>
					</div>
					<div class="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Personal Best
						</p>
						<p class="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
							{completionResult?.personalBest === null
								? "First solve"
								: formatElapsedTime(completionResult?.personalBest ?? 0)}
						</p>
						<p class="mt-1 text-sm text-slate-600">
							{completionResult?.improvedPersonalBest
								? "New best time secured."
								: "Keep pushing for a better run."}
						</p>
					</div>
				</div>

				<div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<button
						class="min-h-12 rounded-[22px] bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
						onclick={handlePlayAgain}
					>
						Play Again
					</button>
					<button
						class="min-h-12 rounded-[22px] bg-teal-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-600"
						onclick={handleOpenScoreComposer}
					>
						Comment My Score
					</button>
					<button
						class="min-h-12 rounded-[22px] bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
						onclick={handleJoinSubreddit}
						disabled={joiningSubreddit}
					>
						{joiningSubreddit ? "Joining…" : `Join r/${subredditName}`}
					</button>
					<button
						class="min-h-12 rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
						onclick={handleViewLeaderboard}
					>
						View Leaderboard
					</button>
				</div>

				{#if scoreCommentStatus}
					<p class="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
						{scoreCommentStatus}
					</p>
				{/if}

				{#if subscribeStatus}
					<p class="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-700">
						{subscribeStatus}
					</p>
				{/if}

				{#if scoreComposerOpen && completionResult !== null}
					<div class="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 p-4">
						<div class="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
							<div>
								<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
									Optional Note
								</p>
								<p class="mt-2 text-sm leading-6 text-slate-600">
									Leave this blank to reply in the sticky score thread. Add a note if you want a human top-level comment instead.
								</p>
								<textarea
									class="mt-4 min-h-32 w-full rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200"
									bind:value={scoreCommentNote}
									placeholder="Optional: lunch-break PB, rivalry callout, strategy note…"
								></textarea>
								<div class="mt-4 flex flex-wrap gap-2">
									<button
										class="min-h-11 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
										onclick={handleCommentScore}
										disabled={commentingScore}
									>
										{commentingScore ? "Posting…" : "Post Comment"}
									</button>
									<button
										class="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
										onclick={() => {
											scoreComposerOpen = false;
										}}
									>
										Cancel
									</button>
								</div>
							</div>
							<div>
								<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
									Exact Preview
								</p>
								<div class="mt-4 rounded-[22px] border border-slate-200 bg-white p-4">
									<p class="mb-3 text-xs uppercase tracking-[0.18em] text-slate-400">
										Target: {scoreCommentNote.trim().length > 0
											? "Top-level discussion comment"
											: "Sticky score thread reply"}
									</p>
									<pre class="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-700">
{commentPreview}
									</pre>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</section>

			<div class="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
				<section
					bind:this={leaderboardPanel}
					class="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur"
				>
					<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
						Leaderboard Snapshot
					</p>
					<h2 class="mt-2 font-serif text-3xl tracking-[-0.05em] text-slate-950">
						Keep the thread moving
					</h2>
					<div class="mt-4 space-y-3">
						{#if leaderboardEntries.length === 0}
							<p class="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
								The leaderboard will appear after the first featured solve.
							</p>
						{:else}
							{#each leaderboardEntries.slice(0, 5) as entry (entry.userId)}
								<div class="flex items-center justify-between rounded-[22px] bg-slate-50 px-4 py-3">
									<div class="flex items-center gap-3">
										<div class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 font-mono text-xs font-semibold text-white">
											#{entry.rank}
										</div>
										<div>
											<p class="text-sm font-semibold text-slate-950">
												{entry.username}
											</p>
											<p class="text-xs uppercase tracking-[0.18em] text-slate-400">
												{formatDifficulty(entry.difficulty)}
											</p>
										</div>
									</div>
									<p class="font-mono text-sm font-semibold text-teal-700">
										{formatElapsedTime(entry.adjustedTime)}
									</p>
								</div>
							{/each}
						{/if}
					</div>
				</section>

				<section
					class="rounded-[32px] border border-white/70 bg-white/82 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur"
				>
					<p class="font-mono text-xs uppercase tracking-[0.3em] text-teal-700">
						Today’s Goals
					</p>
					<h2 class="mt-2 font-serif text-3xl tracking-[-0.05em] text-slate-950">
						Habit momentum
					</h2>
					<div class="mt-4 space-y-3">
						{#each DAILY_GOAL_META as goal (goal.id)}
							<div class="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
								<div class="flex items-start justify-between gap-3">
									<div>
										<p class="text-sm font-semibold text-slate-950">
											{goal.label}
										</p>
										<p class="mt-1 text-sm text-slate-600">
											{goal.description}
										</p>
									</div>
									<span
										class={[
											"rounded-full px-3 py-1 text-xs font-semibold",
											goalState[goal.id]
												? "bg-emerald-100 text-emerald-700"
												: "bg-slate-200 text-slate-600",
										]}
									>
										{goalState[goal.id] ? "Done" : "Open"}
									</span>
								</div>
							</div>
						{/each}
					</div>

					<div class="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
						<p class="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-500">
							Recent completions
						</p>
						<div class="mt-3 space-y-3">
							{#if recentCompletions.length === 0}
								<p class="text-sm text-slate-600">
									No recent activity yet.
								</p>
							{:else}
								{#each recentCompletions.slice(0, 4) as event (`complete-${event.username}-${event.completedAtIso}`)}
									<div class="rounded-[18px] bg-white px-4 py-3">
										<p class="text-sm font-semibold text-slate-950">
											{event.username} finished in {formatElapsedTime(event.adjustedTime)}
										</p>
										<p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
											{formatDifficulty(event.difficulty)}
										</p>
									</div>
								{/each}
							{/if}
						</div>
					</div>
				</section>
			</div>
		</div>
	{/if}
</main>
