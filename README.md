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
