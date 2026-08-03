<script lang="ts">
    import { onMount } from "svelte";
    import type {
        Difficulty,
        SubmitScreenState,
        SubmissionHistoryEntry,
    } from "../lib/types";

    let { onClose }: { onClose: () => void } = $props();

    let screen: SubmitScreenState = $state("input");
    let puzzleInput = $state("");
    let errorMessage: string | null = $state(null);

    let previewDifficulty: Difficulty | null = $state(null);
    let previewClueCount = $state(0);
    let previewPuzzle = $state("");
    let postUrl = $state("");

    let historyLoading = $state(true);
    let historyError: string | null = $state(null);
    let history: SubmissionHistoryEntry[] = $state([]);

    const previewGrid = $derived.by((): number[][] => {
        if (previewPuzzle.length !== 81) return [];
        const rows: number[][] = [];
        for (let r = 0; r < 9; r++) {
            const row: number[] = [];
            for (let c = 0; c < 9; c++) {
                row.push(Number(previewPuzzle[r * 9 + c] ?? "0"));
            }
            rows.push(row);
        }
        return rows;
    });

    const difficultyLabel = (d: Difficulty): string => {
        const map: Record<Difficulty, string> = {
            simple: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
            easy: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
            intermediate:
                "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
            expert: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
        };
        return map[d];
    };

    const formatDate = (ts: number): string =>
        new Date(ts).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
        });

    const handleValidate = async (): Promise<void> => {
        if (!puzzleInput.trim()) return;
        screen = "validating";
        errorMessage = null;
        try {
            const res = await fetch("/api/community/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ puzzle: puzzleInput.trim() }),
            });
            const json = await res.json();
            if (json.status === "error") throw new Error(json.message);
            previewDifficulty = json.data.difficulty as Difficulty;
            previewClueCount = json.data.clueCount as number;
            previewPuzzle = json.data.preview as string;
            screen = "preview";
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : "Validation failed";
            screen = "input";
        }
    };

    const handleConfirm = async (): Promise<void> => {
        screen = "submitting";
        errorMessage = null;
        try {
            const res = await fetch("/api/community/submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ puzzle: previewPuzzle }),
            });
            const json = await res.json();
            if (json.status === "error") throw new Error(json.message);
            postUrl = json.data.postUrl as string;
            screen = "success";
            void fetchHistory();
        } catch (e) {
            errorMessage = e instanceof Error ? e.message : "Submission failed";
            screen = "preview";
        }
    };

    const handleCancel = (): void => {
        screen = "input";
        errorMessage = null;
    };

    const handleSubmitAnother = (): void => {
        puzzleInput = "";
        previewDifficulty = null;
        previewClueCount = 0;
        previewPuzzle = "";
        postUrl = "";
        errorMessage = null;
        screen = "input";
    };

    const fetchHistory = async (): Promise<void> => {
        historyLoading = true;
        historyError = null;
        try {
            const res = await fetch("/api/community/my-puzzles");
            const json = await res.json();
            if (json.status === "error") throw new Error(json.message);
            history = json.data.puzzles as SubmissionHistoryEntry[];
        } catch (e) {
            historyError = e instanceof Error ? e.message : "Failed to load";
        } finally {
            historyLoading = false;
        }
    };

    onMount(() => {
        void fetchHistory();
    });
</script>

<div
    class="h-full w-full overflow-hidden flex flex-col bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
>
    <!-- Header — matches leaderboard overlay style -->
    <div
        class="flex shrink-0 items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-700"
    >
        <span class="text-base font-semibold">Submit a Puzzle</span>
        <button
            class="min-h-11 min-w-11 rounded-lg bg-neutral-100 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            onclick={onClose}
            aria-label="Close"
        >
            ✕ Close
        </button>
    </div>

    <!-- Scrollable content, constrained width -->
    <div class="flex-1 min-h-0 overflow-y-auto">
        <div class="mx-auto w-full max-w-sm px-4 py-4 flex flex-col gap-5">
            <!-- Submission flow -->
            {#if screen === "input"}
                <div class="flex flex-col gap-3">
                    <p class="text-xs text-neutral-500 dark:text-neutral-400">
                        Paste an 81-character puzzle string (digits 0–9, 0 =
                        empty cell).
                    </p>
                    <textarea
                        class="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 font-mono text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="003020600900305001..."
                        bind:value={puzzleInput}
                        aria-label="Puzzle string"
                    ></textarea>
                    {#if errorMessage !== null}
                        <p
                            class="text-xs text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    {/if}
                    <button
                        class="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick={handleValidate}
                        disabled={!puzzleInput.trim()}
                    >
                        Validate
                    </button>
                </div>
            {:else if screen === "validating"}
                <div class="flex flex-col items-center gap-3 py-8">
                    <div
                        class="h-7 w-7 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
                        role="status"
                        aria-label="Validating"
                    ></div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">
                        Validating…
                    </p>
                </div>
            {:else if screen === "preview"}
                <div class="flex flex-col gap-3">
                    <div class="flex items-center gap-2">
                        {#if previewDifficulty !== null}
                            <span
                                class="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize {difficultyLabel(
                                    previewDifficulty,
                                )}"
                            >
                                {previewDifficulty}
                            </span>
                        {/if}
                        <span
                            class="text-xs text-neutral-500 dark:text-neutral-400"
                            >{previewClueCount} clues</span
                        >
                    </div>

                    <!-- Compact 9×9 grid -->
                    <div
                        class="grid grid-cols-9 border-2 border-neutral-700 dark:border-neutral-300 w-full"
                        role="grid"
                        aria-label="Puzzle preview"
                    >
                        {#each previewGrid as row, r (r)}
                            {#each row as cell, c (c)}
                                {@const boxR = r === 2 || r === 5}
                                {@const boxC = c === 2 || c === 5}
                                <div
                                    class="aspect-square flex items-center justify-center text-xs border border-neutral-300 dark:border-neutral-600
                                        {boxC
                                        ? 'border-r-2 border-r-neutral-700 dark:border-r-neutral-300'
                                        : ''}
                                        {boxR
                                        ? 'border-b-2 border-b-neutral-700 dark:border-b-neutral-300'
                                        : ''}
                                        {cell !== 0
                                        ? 'font-bold text-neutral-900 dark:text-neutral-100 bg-neutral-100 dark:bg-neutral-700'
                                        : 'bg-white dark:bg-neutral-800'}"
                                    role="gridcell"
                                >
                                    {cell !== 0 ? cell : ""}
                                </div>
                            {/each}
                        {/each}
                    </div>

                    {#if errorMessage !== null}
                        <p
                            class="text-xs text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    {/if}

                    <p
                        class="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200"
                    >
                        Publishing creates a public Reddit post from your account.
                        It will show this puzzle and identify you as its creator.
                    </p>

                    <div class="flex gap-2">
                        <button
                            class="flex-1 min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onclick={handleConfirm}
                        >
                            Publish Puzzle
                        </button>
                        <button
                            class="flex-1 min-h-11 rounded-lg bg-neutral-100 dark:bg-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onclick={handleCancel}
                        >
                            Back
                        </button>
                    </div>
                </div>
            {:else if screen === "submitting"}
                <div class="flex flex-col items-center gap-3 py-8">
                    <div
                        class="h-7 w-7 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
                        role="status"
                        aria-label="Submitting"
                    ></div>
                    <p class="text-sm text-neutral-500 dark:text-neutral-400">
                        Creating post…
                    </p>
                </div>
            {:else if screen === "success"}
                <div class="flex flex-col gap-3">
                    <p
                        class="text-sm font-semibold text-green-700 dark:text-green-400"
                    >
                        🎉 Puzzle submitted!
                    </p>
                    {#if postUrl}
                        <a
                            href={postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="min-h-11 flex items-center justify-center rounded-lg border border-blue-600 dark:border-blue-400 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 transition-all hover:bg-blue-50 dark:hover:bg-blue-900/20 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            View Post ↗
                        </a>
                    {/if}
                    <button
                        class="min-h-11 rounded-lg bg-neutral-100 dark:bg-neutral-700 px-4 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300 transition-all hover:bg-neutral-200 dark:hover:bg-neutral-600 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onclick={handleSubmitAnother}
                    >
                        Submit Another
                    </button>
                </div>
            {/if}

            <!-- Divider -->
            <div
                class="border-t border-neutral-200 dark:border-neutral-700"
            ></div>

            <!-- My Puzzles -->
            <div>
                <p
                    class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3"
                >
                    My Puzzles
                </p>

                {#if historyLoading}
                    <div class="flex justify-center py-4">
                        <div
                            class="h-5 w-5 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
                            role="status"
                            aria-label="Loading"
                        ></div>
                    </div>
                {:else if historyError !== null}
                    <div class="flex flex-col items-center gap-2 py-3">
                        <p
                            class="text-xs text-red-600 dark:text-red-400"
                            role="alert"
                        >
                            {historyError}
                        </p>
                        <button
                            class="text-xs text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                            onclick={() => void fetchHistory()}>Retry</button
                        >
                    </div>
                {:else if history.length === 0}
                    <p
                        class="text-xs text-neutral-400 dark:text-neutral-500 text-center py-3"
                    >
                        No puzzles submitted yet.
                    </p>
                {:else}
                    <ul class="flex flex-col gap-2" role="list">
                        {#each history as entry (entry.postId)}
                            <li
                                class="flex items-center justify-between rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 px-3 py-2"
                            >
                                <div class="flex items-center gap-2">
                                    <span
                                        class="rounded-full px-2 py-0.5 text-xs font-semibold capitalize {difficultyLabel(
                                            entry.difficulty,
                                        )}"
                                    >
                                        {entry.difficulty}
                                    </span>
                                    <span
                                        class="text-xs text-neutral-400 dark:text-neutral-500"
                                        >{entry.solveCount} solves</span
                                    >
                                </div>
                                <span
                                    class="text-xs text-neutral-400 dark:text-neutral-500"
                                    >{formatDate(entry.createdAt)}</span
                                >
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>
    </div>
</div>
