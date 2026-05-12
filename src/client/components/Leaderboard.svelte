<script lang="ts">
    import type { Difficulty } from "../lib/types";

    type LeaderboardEntry = {
        rank: number | null;
        username: string;
        completionTime: number;
        hintsUsed: number;
        mistakesCount: number;
        adjustedTime: number;
        notesUsed: boolean | undefined;
        unranked: boolean;
    };

    type LeaderboardResponse = {
        entries: LeaderboardEntry[];
        userEntry: LeaderboardEntry | null;
    };

    let {
        difficulty,
        currentUsername,
        mode,
        solveResult,
    }: {
        difficulty: Difficulty;
        currentUsername?: string;
        mode: "panel" | "completion";
        solveResult?: {
            postRank: number;
            globalRank: number;
            adjustedTime: number;
        } | null;
    } = $props();

    type ViewType = "post" | "global";

    let view: ViewType = $state("post");
    let loading = $state(true);
    let error: string | null = $state(null);
    let data: LeaderboardResponse | null = $state(null);

    const formatTime = (s: number): string => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const fetchLeaderboard = async (): Promise<void> => {
        loading = true;
        error = null;
        try {
            const endpoint =
                view === "post"
                    ? `/api/leaderboard/post?difficulty=${difficulty}`
                    : `/api/leaderboard/global?difficulty=${difficulty}`;
            const res = await fetch(endpoint);
            const json = await res.json();
            if (!res.ok || json.status === "error") {
                throw new Error(json.message ?? "Failed to load leaderboard");
            }
            data = json.data as LeaderboardResponse;
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Failed to load leaderboard";
            data = null;
        } finally {
            loading = false;
        }
    };

    $effect(() => {
        // Re-fetch whenever difficulty or view changes
        void difficulty;
        void view;
        fetchLeaderboard();
    });

    const isCurrentUser = (username: string): boolean =>
        currentUsername !== undefined && username === currentUsername;

    // Show user entry below top 10 if they're outside top 10
    const showUserEntryBelow = $derived.by(() => {
        if (data === null || data.userEntry === null) return false;
        const userEntry = data.userEntry;
        return data.entries.every((e) => e.username !== userEntry.username);
    });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <!-- Completion mode: stats card -->
    {#if mode === "completion"}
        <div
            class="mb-3 shrink-0 rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800"
        >
            <h2
                class="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100"
            >
                Your Result
            </h2>
            {#if solveResult !== null && solveResult !== undefined}
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <span class="text-neutral-500 dark:text-neutral-400"
                        >Rank</span
                    >
                    <span
                        class="font-semibold text-neutral-900 dark:text-neutral-100"
                    >
                        #{solveResult.postRank} on this post
                    </span>
                    <span class="text-neutral-500 dark:text-neutral-400"
                        >Score</span
                    >
                    <span
                        class="font-mono font-semibold text-neutral-900 dark:text-neutral-100"
                    >
                        {formatTime(solveResult.adjustedTime)}
                    </span>
                </div>
            {:else}
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                    Solve not recorded
                </p>
            {/if}
        </div>
    {/if}

    <!-- View toggle -->
    <div
        class="mb-2 flex shrink-0 rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800"
    >
        <button
            class={[
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                view === "post"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
            ]}
            onclick={() => (view = "post")}
            aria-pressed={view === "post"}
        >
            This Post
        </button>
        <button
            class={[
                "flex-1 rounded-md py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                view === "global"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200",
            ]}
            onclick={() => (view = "global")}
            aria-pressed={view === "global"}
        >
            Global
        </button>
    </div>

    <!-- Content area -->
    <div class="min-h-0 flex-1 overflow-y-auto">
        {#if loading}
            <div class="flex h-full items-center justify-center">
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                    Loading…
                </p>
            </div>
        {:else if error !== null}
            <div class="flex h-full flex-col items-center justify-center gap-3">
                <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
                <button
                    class="min-h-9 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onclick={() => fetchLeaderboard()}
                >
                    Retry
                </button>
            </div>
        {:else if data === null || data.entries.length === 0}
            <div class="flex h-full items-center justify-center">
                <p class="text-sm text-neutral-500 dark:text-neutral-400">
                    No solves yet
                </p>
            </div>
        {:else}
            <!-- Leaderboard table -->
            <div class="overflow-hidden">
                <table class="w-full text-sm">
                    <thead>
                        <tr
                            class="border-b border-neutral-200 text-left text-xs font-medium text-neutral-500 dark:border-neutral-700 dark:text-neutral-400"
                        >
                            <th class="pb-1.5 pr-2">#</th>
                            <th class="pb-1.5 pr-2">Player</th>
                            <th class="pb-1.5 pr-2 text-right">Time</th>
                            <th class="pb-1.5 pr-2 text-right">Hints</th>
                            <th class="pb-1.5 pr-2 text-right">Err</th>
                            <th class="pb-1.5 text-right">Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.entries as entry (entry.rank)}
                            <tr
                                class={[
                                    "border-b border-neutral-100 dark:border-neutral-800",
                                    isCurrentUser(entry.username)
                                        ? "bg-blue-50 dark:bg-blue-900/20"
                                        : "",
                                ]}
                            >
                                <td
                                    class="py-1.5 pr-2 font-mono text-xs text-neutral-500 dark:text-neutral-400"
                                >
                                    {entry.rank}
                                </td>
                                <td
                                    class="py-1.5 pr-2 font-medium text-neutral-900 dark:text-neutral-100"
                                >
                                    <span class="flex items-center gap-1">
                                        {#if entry.hintsUsed === 0}
                                            <span
                                                title="No hints used"
                                                aria-label="No hints used"
                                                >⭐</span
                                            >
                                        {/if}
                                        <span class="truncate max-w-[80px]"
                                            >{entry.username}</span
                                        >
                                    </span>
                                </td>
                                <td
                                    class="py-1.5 pr-2 text-right font-mono text-xs tabular-nums text-neutral-700 dark:text-neutral-300"
                                >
                                    {formatTime(entry.completionTime)}
                                </td>
                                <td
                                    class="py-1.5 pr-2 text-right text-xs text-neutral-600 dark:text-neutral-400"
                                >
                                    {entry.hintsUsed}
                                </td>
                                <td
                                    class="py-1.5 pr-2 text-right text-xs text-neutral-600 dark:text-neutral-400"
                                >
                                    {entry.mistakesCount}
                                </td>
                                <td
                                    class="py-1.5 text-right font-mono text-xs tabular-nums font-semibold text-neutral-900 dark:text-neutral-100"
                                >
                                    {formatTime(entry.adjustedTime)}
                                </td>
                            </tr>
                        {/each}

                        <!-- User entry below top 10 if outside -->
                        {#if showUserEntryBelow && data.userEntry !== null}
                            <!-- Visual divider -->
                            <tr aria-hidden="true">
                                <td colspan={6} class="py-1">
                                    <div
                                        class="border-t-2 border-dashed border-neutral-300 dark:border-neutral-600"
                                    ></div>
                                </td>
                            </tr>
                            <tr class="bg-blue-50 dark:bg-blue-900/20">
                                <td
                                    class="py-1.5 pr-2 font-mono text-xs text-neutral-500 dark:text-neutral-400"
                                >
                                    {data.userEntry.unranked
                                        ? "—"
                                        : data.userEntry.rank}
                                </td>
                                <td
                                    class="py-1.5 pr-2 font-medium text-neutral-900 dark:text-neutral-100"
                                >
                                    <span class="flex items-center gap-1">
                                        {#if data.userEntry.hintsUsed === 0}
                                            <span
                                                title="No hints used"
                                                aria-label="No hints used"
                                                >⭐</span
                                            >
                                        {/if}
                                        <span class="truncate max-w-[80px]"
                                            >{data.userEntry.username}</span
                                        >
                                        {#if data.userEntry.unranked}
                                            <span
                                                class="ml-2 rounded-full bg-neutral-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300"
                                                >unranked</span
                                            >
                                        {/if}
                                    </span>
                                </td>
                                <td
                                    class="py-1.5 pr-2 text-right font-mono text-xs tabular-nums text-neutral-700 dark:text-neutral-300"
                                >
                                    {formatTime(data.userEntry.completionTime)}
                                </td>
                                <td
                                    class="py-1.5 pr-2 text-right text-xs text-neutral-600 dark:text-neutral-400"
                                >
                                    {data.userEntry.hintsUsed}
                                </td>
                                <td
                                    class="py-1.5 pr-2 text-right text-xs text-neutral-600 dark:text-neutral-400"
                                >
                                    {data.userEntry.mistakesCount}
                                </td>
                                <td
                                    class="py-1.5 text-right font-mono text-xs tabular-nums font-semibold text-neutral-900 dark:text-neutral-100"
                                >
                                    {formatTime(data.userEntry.adjustedTime)}
                                </td>
                            </tr>
                        {/if}
                    </tbody>
                </table>
            </div>
        {/if}
    </div>
</div>
