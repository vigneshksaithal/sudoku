<script lang="ts">
    import { onMount } from "svelte";

    let { onResume, onRestart }: { onResume: () => void; onRestart: () => void } = $props();

    let resumeButtonEl: HTMLButtonElement | null = $state(null);
    let confirming: boolean = $state(false);

    // Focus the Resume button on mount so keyboard users can immediately resume.
    onMount(() => {
        resumeButtonEl?.focus();

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                e.preventDefault();
                if (confirming) {
                    // Cancel the confirm dialog and return to the main pause menu
                    confirming = false;
                } else {
                    onResume();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    });

    // Trap Tab focus inside the overlay.
    const handleSentinelFocus = (): void => {
        resumeButtonEl?.focus();
    };

    const handleOverlayPointerDown = (e: PointerEvent): void => {
        e.stopPropagation();
        if (!confirming) onResume();
    };

    const handleButtonPointerDown = (e: PointerEvent): void => {
        // Stop propagation so button clicks don't also fire the overlay handler.
        e.stopPropagation();
    };

    const handleRestartRequest = (): void => {
        confirming = true;
    };

    const handleRestartConfirm = (): void => {
        confirming = false;
        onRestart();
    };

    const handleRestartCancel = (): void => {
        confirming = false;
    };
</script>

<div
    role="dialog"
    aria-modal="true"
    aria-label={confirming ? "Confirm restart" : "Solve paused"}
    tabindex="-1"
    class="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-neutral-900/70"
    onpointerdown={handleOverlayPointerDown}
>
    <!-- Focus sentinel: loops focus back to first button -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <span
        tabindex="0"
        onfocus={handleSentinelFocus}
        class="sr-only"
        aria-hidden="true"
    ></span>

    {#if confirming}
        <!-- Confirmation dialog -->
        <div
            class="flex flex-col items-center gap-4 rounded-xl bg-white dark:bg-neutral-800 shadow-xl px-8 py-6 mx-4 max-w-xs w-full"
            onpointerdown={handleButtonPointerDown}
            role="none"
        >
            <h2 class="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Restart Puzzle?
            </h2>
            <p class="text-sm text-center text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Your progress will be cleared. Your timer continues from where it left off.
            </p>
            <div class="flex flex-col gap-2 w-full">
                <button
                    class="flex items-center justify-center rounded-lg min-h-11 px-6 py-2.5 text-base font-semibold bg-neutral-900 text-white transition-all active:scale-95 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
                    onclick={handleRestartConfirm}
                    onpointerdown={handleButtonPointerDown}
                    aria-label="Confirm restart puzzle"
                >
                    Restart
                </button>
                <button
                    bind:this={resumeButtonEl}
                    class="flex items-center justify-center rounded-lg min-h-11 px-6 py-2.5 text-base font-semibold bg-neutral-100 text-neutral-700 transition-all active:scale-95 hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                    onclick={handleRestartCancel}
                    onpointerdown={handleButtonPointerDown}
                    aria-label="Cancel restart, keep going"
                >
                    Keep Going
                </button>
            </div>
        </div>
    {:else}
        <!-- Default pause menu -->
        <div
            class="flex flex-col items-center gap-3"
            onpointerdown={handleButtonPointerDown}
            role="none"
        >
            <button
                bind:this={resumeButtonEl}
                class="flex items-center justify-center rounded-lg min-h-14 px-8 py-3 text-lg font-semibold bg-white text-neutral-900 shadow-lg transition-all active:scale-95 hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
                onclick={onResume}
                onpointerdown={handleButtonPointerDown}
                aria-label="Resume solve"
            >
                Resume
            </button>
            <button
                class="flex items-center justify-center rounded-lg min-h-11 px-6 py-2.5 text-sm font-medium bg-neutral-100/80 text-neutral-700 shadow transition-all active:scale-95 hover:bg-neutral-200/80 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700/80 dark:text-neutral-300 dark:hover:bg-neutral-600/80"
                onclick={handleRestartRequest}
                onpointerdown={handleButtonPointerDown}
                aria-label="Restart puzzle"
            >
                Restart Puzzle
            </button>
        </div>
    {/if}

    <!-- Focus sentinel: catches Shift+Tab and loops focus back -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <span
        tabindex="0"
        onfocus={handleSentinelFocus}
        class="sr-only"
        aria-hidden="true"
    ></span>
</div>
