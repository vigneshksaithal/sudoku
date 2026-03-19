# Requirements Document

## Introduction

This document defines the requirements for a comprehensive UI redesign and code refactor of the Sudoku game. The current interface lacks visual polish, layout consistency, and responsive behavior. The redesign targets two distinct layouts — a side-by-side desktop view (grid left, controls right) and a stacked mobile view (grid top, controls bottom) — with a clean, minimal aesthetic. The NumberPad is redesigned with a Normal/Candidate tab-style toggle, a 5-column digit layout (1–5 top row, 6–9 plus erase bottom row), a separate Undo button, and an Auto Candidate Mode checkbox. The code refactor improves component structure, readability, and maintainability following established project engineering standards.

## Glossary

- **App**: The root Svelte component (`App.svelte`) that manages game state, screen transitions, and user interactions.
- **Grid**: The Svelte component (`Grid.svelte`) that renders the 9×9 Sudoku board with cell selection and highlighting.
- **NumberPad**: The Svelte component (`NumberPad.svelte`) that provides digit entry and game action controls.
- **HintPanel**: The Svelte component (`HintPanel.svelte`) that displays technique-based hints with apply/dismiss actions.
- **GameLayout**: The responsive layout container that arranges the Grid and controls side-by-side on desktop and stacked on mobile.
- **ControlPanel**: The right-side (desktop) or bottom (mobile) area containing the NumberPad, Undo button, and Auto Candidate Mode checkbox.
- **ModeTab**: A tab-style toggle within the NumberPad that switches between Normal input mode and Candidate (notes) input mode.
- **DigitGrid**: The 5-column grid of digit buttons (1–5 top row, 6–9 and erase bottom row) within the NumberPad.
- **Cell**: A single square in the 9×9 Sudoku Grid representing one digit position.
- **Given_Digit**: A pre-filled digit provided as a puzzle clue that cannot be modified by the player.
- **User_Digit**: A digit entered by the player into an empty cell.
- **Selected_Cell**: The cell currently focused by the player for input, highlighted with an amber/orange background.
- **Box_Border**: The thick border separating 3×3 boxes within the Grid.
- **Cell_Border**: The thin border separating individual cells within a 3×3 box.
- **Mobile_Viewport**: A viewport width below 640px (Tailwind `sm` breakpoint), representing mobile devices including the Devvit inline view at ~343px minimum width.
- **Desktop_Viewport**: A viewport width at or above 640px (Tailwind `sm` breakpoint).
- **Breakpoint_Width**: 640px, the threshold between Mobile_Viewport and Desktop_Viewport layouts.

## Requirements

### Requirement 1: Responsive Two-Layout System

**User Story:** As a player, I want the game to display a side-by-side layout on desktop and a stacked layout on mobile, so that the interface is optimized for the device I am using.

#### Acceptance Criteria

1. WHEN the viewport width is at or above the Breakpoint_Width, THE GameLayout SHALL render the Grid on the left and the ControlPanel on the right in a horizontal arrangement.
2. WHEN the viewport width is below the Breakpoint_Width, THE GameLayout SHALL render the Grid on top and the ControlPanel below in a vertical arrangement.
3. THE GameLayout SHALL use CSS-based responsive breakpoints (Tailwind `sm:` prefix) to switch between layouts without JavaScript viewport detection.
4. WHILE the viewport is in Mobile_Viewport mode, THE Grid SHALL expand to fill the available width up to a maximum that preserves the aspect-square constraint.
5. WHILE the viewport is in Desktop_Viewport mode, THE Grid SHALL occupy approximately 60% of the horizontal space and the ControlPanel SHALL occupy the remaining space.
6. THE GameLayout SHALL prevent any content overflow or scrolling within the Devvit webview container at all supported viewport sizes (minimum 343×512px).

### Requirement 2: Grid Visual Redesign

**User Story:** As a player, I want the Sudoku grid to have clear visual hierarchy with thick box borders, thin cell borders, and distinct styling for given vs user digits, so that the board is easy to read.

#### Acceptance Criteria

1. THE Grid SHALL render Box_Borders with a visually heavier weight (2px) than Cell_Borders (1px) to clearly delineate the nine 3×3 boxes.
2. THE Grid SHALL render Given_Digits in bold with a larger relative font weight than User_Digits.
3. THE Grid SHALL render User_Digits in a distinct color (blue) to differentiate them from Given_Digits (dark/neutral).
4. WHEN a Cell is the Selected_Cell, THE Grid SHALL highlight that cell with an amber/orange background color (`bg-amber-200` light, `bg-amber-500/40` dark).
5. THE Grid SHALL apply a subtle alternating background tint to 3×3 boxes to improve visual grouping (alternating between white/neutral-50 and neutral-100/neutral-800).
6. THE Grid SHALL maintain the existing notes display (3×3 mini-grid of candidate digits) within empty cells.
7. THE Grid SHALL support both light and dark color themes using Tailwind dark-mode variants.

### Requirement 3: NumberPad Redesign with Mode Tabs

**User Story:** As a player, I want the number pad to have a tab-style toggle between Normal and Candidate modes with digits arranged in a 5-column layout, so that input is intuitive and mode switching is clear.

#### Acceptance Criteria

1. THE NumberPad SHALL display two ModeTab buttons labeled "Normal" and "Candidate" at the top of the pad, styled as a segmented tab control.
2. WHEN the Normal ModeTab is active, THE NumberPad SHALL render the Normal tab with a filled/highlighted appearance and the Candidate tab with a muted appearance.
3. WHEN the Candidate ModeTab is active, THE NumberPad SHALL render the Candidate tab with a filled/highlighted appearance and the Normal tab with a muted appearance.
4. WHEN a player taps a ModeTab, THE NumberPad SHALL switch the input mode to the corresponding mode (Normal or Candidate).
5. THE NumberPad SHALL render the DigitGrid with digits 1 through 5 in the first row and digits 6 through 9 plus an erase button (✕) in the second row, using a 5-column grid layout.
6. WHEN a digit's count on the board equals 9 (all instances placed), THE NumberPad SHALL render that digit button with reduced opacity (opacity-40) to indicate completion.
7. THE NumberPad SHALL keep completed-digit buttons clickable (not disabled) to allow overwriting incorrect placements.

### Requirement 4: Undo Button Placement

**User Story:** As a player, I want the Undo button positioned separately from the digit grid, so that it is easy to find and does not interfere with digit entry.

#### Acceptance Criteria

1. THE ControlPanel SHALL render the Undo button above the DigitGrid area, positioned at the top-right of the NumberPad section.
2. THE Undo button SHALL display an undo icon (↩) with the label "Undo".
3. WHEN the undo stack is empty, THE Undo button SHALL appear disabled with reduced opacity.
4. WHEN the player taps the Undo button, THE App SHALL restore the previous board and notes state from the undo stack.

### Requirement 5: Auto Candidate Mode Checkbox

**User Story:** As a player, I want an Auto Candidate Mode checkbox below the number pad, so that I can toggle automatic candidate computation with a clear, persistent control.

#### Acceptance Criteria

1. THE ControlPanel SHALL render a checkbox labeled "Auto Candidate Mode" below the DigitGrid.
2. WHEN the player checks the Auto Candidate Mode checkbox, THE App SHALL invoke the auto-candidate computation to fill all valid candidates for empty cells.
3. WHEN the Auto Candidate Mode checkbox is checked and auto-candidates are already active, THE App SHALL clear the auto-candidates from the notes board.
4. THE Auto Candidate Mode checkbox SHALL reflect the current auto-candidate state (checked when auto-candidates are active, unchecked otherwise).

### Requirement 6: Hint Button Integration

**User Story:** As a player, I want the Hint button accessible within the control area, so that I can request technique-based hints without cluttering the digit grid.

#### Acceptance Criteria

1. THE ControlPanel SHALL render a Hint button (💡) alongside the Undo button in the top area of the NumberPad section.
2. WHEN hints are disabled (no solution available or a hint is already active), THE Hint button SHALL appear disabled with reduced opacity.
3. WHEN the player taps the Hint button, THE App SHALL compute and display a technique-based hint using the existing hint engine.
4. THE HintPanel SHALL continue to render between the Grid and NumberPad (mobile) or below the Grid (desktop) when a hint is active.

### Requirement 7: Selected Cell Highlight Styling

**User Story:** As a player, I want the selected cell to be highlighted in amber/orange, so that my current focus is clearly visible against the grid.

#### Acceptance Criteria

1. WHEN a single cell is selected, THE Grid SHALL apply an amber/orange background (`bg-amber-200` in light mode, `bg-amber-500/40` in dark mode) to the Selected_Cell.
2. WHEN multiple cells are selected (drag/shift-click), THE Grid SHALL apply the amber/orange highlight to all selected cells.
3. THE amber/orange selection highlight SHALL take visual precedence over the digit-matching highlight (blue) and note-matching highlight (yellow).
4. THE Grid SHALL retain the existing conflict highlight (red background) which takes precedence over all other highlights for cells with conflicts.

### Requirement 8: Difficulty Tab Bar Styling

**User Story:** As a player, I want the difficulty selector to be visually consistent with the redesigned UI, so that the overall look is cohesive.

#### Acceptance Criteria

1. THE App SHALL render the difficulty tab bar as a row of pill-shaped buttons at the top of the game screen.
2. WHEN a difficulty is selected, THE App SHALL render that tab with a filled primary color (blue) background and white text.
3. WHEN a difficulty is not selected, THE App SHALL render that tab with a subtle neutral background and muted text.
4. THE difficulty tab bar SHALL use compact sizing (text-xs or text-sm, py-1 px-2) to minimize vertical space consumption.

### Requirement 9: Code Structure and Maintainability Refactor

**User Story:** As a developer, I want the UI components to follow consistent patterns with clear separation of concerns, so that the codebase is easy to maintain and extend.

#### Acceptance Criteria

1. THE Grid component SHALL extract cell class computation into a dedicated pure function that accepts cell state, selection state, and highlight state as parameters and returns a class string.
2. THE NumberPad component SHALL accept a clearly typed props interface with explicit callback types for all user actions.
3. THE App component SHALL organize event handlers into logical groups (cell interaction, digit input, game actions, navigation) with consistent naming conventions.
4. THE codebase SHALL use Svelte 5 runes (`$state`, `$derived`, `$props`) exclusively with no Svelte 4 syntax.
5. THE codebase SHALL use Tailwind CSS utility classes exclusively with no `<style>` blocks in any Svelte component.

### Requirement 10: Pixel Budget Compliance

**User Story:** As a developer, I want the redesigned layout to fit within the Devvit webview pixel budget (343×512px minimum), so that no content overflows or is clipped on any device.

#### Acceptance Criteria

1. THE GameLayout SHALL fit all visible elements (difficulty tabs, grid, controls, validation messages) within a 343×512px viewport without overflow.
2. THE GameLayout root container SHALL use `h-full w-full overflow-hidden flex flex-col` to prevent any scrolling.
3. WHILE a HintPanel is visible, THE GameLayout SHALL accommodate the hint panel without pushing other elements outside the viewport.
4. THE GameLayout SHALL use `shrink-0` on fixed-height elements (difficulty tabs, controls) and `flex-1 min-h-0` on the flexible content area (grid).
5. THE Grid SHALL use `max-h-full` in combination with `aspect-square` to shrink when vertical space is constrained.

### Requirement 11: Touch Target Compliance

**User Story:** As a mobile player, I want all interactive elements to be large enough to tap accurately, so that I do not accidentally press the wrong button.

#### Acceptance Criteria

1. THE NumberPad digit buttons SHALL have a minimum touch target size of 36×36px.
2. THE Undo and Hint buttons SHALL have a minimum touch target size of 44×44px (`min-h-11 min-w-11`).
3. THE ModeTab buttons SHALL have a minimum touch target height of 36px.
4. THE Grid cells SHALL have a minimum size of 32×32px to remain tappable on the smallest supported viewport (343px width).
5. THE spacing between adjacent interactive elements SHALL be at least 4px (`gap-1`) to prevent accidental taps.

### Requirement 12: Theme Support

**User Story:** As a player, I want the redesigned UI to support both light and dark themes, so that the game looks good in any Reddit viewing mode.

#### Acceptance Criteria

1. THE App SHALL define both light and dark color variants for all backgrounds, text, and borders using Tailwind `dark:` prefix classes.
2. THE Grid SHALL use neutral tones (neutral-100 through neutral-800) for backgrounds and borders in both themes.
3. THE NumberPad SHALL use neutral tones for button backgrounds with appropriate contrast in both themes.
4. THE selected cell amber/orange highlight SHALL be visible and distinguishable in both light and dark themes.
