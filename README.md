# Sudoku

A playable Sudoku puzzle embedded in Reddit posts via Devvit. Each post contains four independent puzzles — Simple, Easy, Intermediate, and Expert — each with a unique solution.

## What it does

When a moderator creates a Sudoku post, the app generates four puzzles (one per difficulty) and stores them in Redis. Players open the post, pick a difficulty, and solve the 9×9 grid using tap-based input. Conflict detection highlights duplicate digits in real time. When the board is complete, the app validates the solution server-side and shows a success screen.

## How to use

**For moderators:** Click "Create a new post" from the subreddit menu to publish a new Sudoku puzzle post.

**For players:** Open a Sudoku post, choose a difficulty (Simple, Easy, Intermediate, or Expert), tap a cell, then tap a number to fill it in. Conflicts are highlighted in red as you go. Submit when all cells are filled.

## Features

- Four difficulty levels with technique-based grading (Simple → Expert)
- Unique-solution guarantee — every puzzle has exactly one valid answer
- Real-time conflict detection across rows, columns, and 3×3 boxes
- Mobile-first tap interface with 36×36px minimum touch targets
- Light and dark mode support via Tailwind CSS
- Server-side validation on completion

## Development

Use Node.js 24.18.0 or newer in the 24.x LTS line and Bun 1.4.3.

```sh
bun install
bun run test
bun run type-check
bun run check
bun run build
```

TypeScript 7.0.2 is installed as `@typescript/native` and used by the project
type check and Svelte's `--tsgo` mode. TypeScript 6.0.3 is retained for Svelte's
JavaScript compiler API, as required by the
[Svelte checker](https://github.com/sveltejs/language-tools/blob/master/packages/svelte-check/README.md).
The separate `tsconfig.svelte-check.json` lets the checker include generated
Svelte files without changing the composite build configuration.

## Devvit 0.15 migration

All direct Devvit packages use 0.15.0. Reviewed the
[0.14 release notes](https://developers.reddit.com/docs/0.14/changelog) and
[0.15 release notes](https://developers.reddit.com/docs/changelog):

- Devvit 0.14 moves the runtime to Node.js 24 and replaces the native Redis test
  server with a JavaScript implementation. The server tests exercise puzzle
  storage, cooldown expiry, submission history, and leaderboards against it.
- Devvit 0.15 removes `devvit.yaml` and the positional wiki revision argument.
  This app already uses `devvit.json` and does not call wiki APIs.
- Removed the deprecated `inline` entrypoint setting, which has no effect.
  The preview remains the default entrypoint and opens `game` in expanded mode.
- Highlight APIs, wiki updates, expanded-mode titles/navigation, and dynamic
  scheduler improvements do not require changes to this app's existing flows.

Run `bun run dev` for a Reddit playtest before uploading a release.

### Cleaning historical leaderboards

After publishing this version and updating the subreddit installation, a moderator can run **Clean global leaderboard** from the subreddit menu. Repeat it until the toast says cleanup is complete; each invocation processes at most 25 entries in one difficulty. Use **Clean post leaderboard** from an individual app post's menu to do the same for that post. Run the cleanup when leaderboard activity is low and repeat a full pass if scores changed during a pass, since the scan uses rank-based pagination.

The cleanup removes entries when the recorded completion time is under 10 seconds, the record is malformed, the record is unranked, or its adjusted time differs from the leaderboard score. It deletes the backing global solve records, while retaining post solve records as unranked to preserve solve-count and duplicate tracking. Other entries are preserved; a deleted historical best cannot be recovered from the affected record. Global records do not identify their original puzzle, so the historical threshold is deliberately conservative and cannot detect every implausible score. Old post boards must be cleaned individually.

New ranked solves require the correct board and a server timer. Their minimum time is two seconds per empty cell, with a minimum of 10 seconds; missing or inconsistent timing and faster solves are recorded as unranked. Pauses are tracked by the server. These checks deter trivial submissions, but cannot prove a human solved the puzzle: the client receives solutions to support hints, and a caller can wait before submitting one.
