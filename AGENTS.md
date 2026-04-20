# AGENTS.md

## Agent Workflow — Mandatory Checklist

Every request — no matter how small — must follow these steps in order. Do not skip steps.

### Step 1: Gather Context

Before reasoning about the request, collect information:

1. Read relevant `.agents/skills/*.md` files for the domain being touched
2. Use MCP tools to look up any platform/framework APIs you're unsure about
3. Read the source files involved — understand existing patterns, types, and boundaries
4. If the request touches multiple domains, read all relevant skills

Available skills in `.agents/skills/`:

| Skill | When to read |
|-------|-------------|
| `tdd/SKILL.md` | Any task that involves writing or modifying tests |
| `api-route/SKILL.md` | Adding or changing Hono API routes |
| `svelte-component/SKILL.md` | Creating or modifying Svelte components |
| `redis-schema/SKILL.md` | Any Redis key/data structure changes |
| `reddit-api/SKILL.md` | Interacting with Reddit API |
| `devvit-config/SKILL.md` | Devvit configuration changes |
| `realtime/SKILL.md` | Live updates, multiplayer, event-driven features |
| `scheduler/SKILL.md` | Cron jobs, delayed tasks, timed events |
| `media-uploads/SKILL.md` | Uploading images to Reddit at runtime |
| `settings-secrets/SKILL.md` | App settings, API keys, moderator config |

### Step 2: Clarify Requirements

Ask the user questions until you are ≥90% confident in the implementation approach.

- Cover: expected behavior, edge cases, integration points, constraints, user preferences
- Ask about how this feature interacts with existing code
- Ask about error states and what should happen when things go wrong
- Ask about future extensibility — what might change later?
- Do not proceed until ≥90% confident. It is better to ask one extra question than to build the wrong thing.

**Done when:** You can describe the exact changes you'll make, which files you'll touch, and what the expected behavior is — and the user confirms.

### Step 3: Plan

Write a brief plan before touching any code:

- Which files will be created or modified?
- What types/interfaces need to change?
- What are the test cases (inputs → expected outputs)?
- Are there any breaking changes to existing code?

**Done when:** You have a concrete list of changes and test cases.

### Step 4: Write Failing Tests (Red)

Write tests before implementation. Only write tests that are relevant to the change — no filler.

1. Check if `__tests__/*.test.ts` exists for the module being changed
2. Add test cases that describe the new/changed behavior
3. Run `bun run test` — confirm the new tests fail (existing tests still pass)

**What must be tested:**

| Layer | Must test | Can skip |
|-------|----------|----------|
| `src/server/**/*.ts` | All routes, handlers, business logic | — |
| `src/server/lib/**/*.ts` | All helpers, validators, transforms | — |
| `src/shared/**/*.ts` | All pure functions | — |
| `src/client/lib/**/*.ts` | Extracted logic files | `.svelte` files |
| Config / docs / skills | — | Always skip |

**Done when:** `bun run test` runs, new tests fail with expected errors, existing tests pass.

### Step 5: Implement (Green)

Write production-grade code to make the failing tests pass. See [Engineering Standards](#engineering-standards) below.

**Done when:** `bun run test` passes with zero failures.

### Step 6: Refactor

Improve the code while keeping tests green:

- Remove duplication
- Improve naming
- Simplify control flow
- Ensure proper error handling and edge cases
- Verify the code is extensible — will it hold up as the codebase grows?

**Done when:** `bun run test` still passes. Code meets engineering standards.

### Step 7: Verify

```bash
bun run test && bun run type-check
```

**Done when:** Zero test failures, zero type errors.

---

## Engineering Standards

Write production-grade code. Not prototypes, not MVPs. Code that scales, reads well, and doesn't create debt.

### Single Responsibility
- One function does one thing. One file owns one concern.
- If a function name contains "and" or "or", split it.
- Functions ≤30 lines. If longer, extract helpers.

### Open for Extension, Closed for Modification
- Use types/interfaces to define contracts between modules.
- New behavior should be addable without rewriting existing code.
- Prefer composition over conditionals — don't add `if (newFeature)` branches to existing functions.

### Dependency Inversion
- Depend on interfaces/types, not concrete implementations.
- Pass dependencies as function arguments rather than importing singletons where possible.
- This makes code testable and swappable.

### Pure Functions by Default
- Same input → same output, no side effects.
- No mutation of function arguments — return new values.
- Prefer `map`, `filter`, `reduce` over imperative loops.
- Side effects (API calls, Redis, DOM) live at the boundary, not in business logic.

### Defensive Error Handling
- Fail fast with descriptive errors — never silently swallow failures.
- Handle all edge cases: `null`, `undefined`, empty arrays, missing keys.
- Validate inputs at module boundaries. Trust nothing from external sources.
- Use `unknown` over `any`, then narrow with type guards.

### Readability
- Code reads top-to-bottom — put helpers below their callers.
- Descriptive names over comments: `getUserScore()` not `getVal()`.
- Early returns to avoid nesting: guard → bail, then happy path.
- Max one level of callback nesting — extract named functions.
- Comments explain *why*, never *what*.

### No Dead Weight
- No dead code, no commented-out code, no "just in case" abstractions.
- No unused imports, variables, or parameters.
- If you're not sure it's needed, it's not needed.

---

## Code Style

### TypeScript

- `strict: true` with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`
- Array/object index access returns `T | undefined` — always handle it
- `const` by default, `let` only if reassigned, never `var`
- `as const` for literal arrays/objects
- Explicit return types on exported functions
- Arrow function expressions: `const foo = (): void => {}`

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Variables, functions | camelCase | `getUserScore` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_ATTEMPTS` |
| Types, interfaces | PascalCase | `GameState` |
| Svelte components | PascalCase file | `GameBoard.svelte` |
| Non-component files | kebab-case | `game-logic.ts` |
| API routes | kebab-case | `/api/game-state` |
| Redis keys | colon-delimited | `user:{userId}:stats` |

### Imports

```typescript
// 1. External packages
import { Hono } from 'hono'
import type { Context } from 'hono'

// 2. Local modules
import { createPost } from './post'

// 3. Side-effect imports last
import './app.css'
```

---

## Build & Dev Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun run build` | Production build to `dist/` |
| `bun run test` | Run all tests (Vitest) |
| `bun run type-check` | TypeScript composite build check |
| `bun run check` | Svelte-specific type checking |
| `bun run dev` | Start dev server (vite watch + devvit playtest) |
| `bun run deploy` | Build and upload to Devvit |

**Before committing:** `bun run test && bun run type-check`

**Test stack:** Vitest + `@devvit/test` (in-memory Redis, Reddit API mocks, per-test isolation). Tests live in `__tests__/` directories colocated with source.

> No linter or formatter is configured. Do not add these tools without explicit instruction.

---

## Architecture

Devvit app running inside Reddit posts as a sandboxed webview.

```
src/
├── client/     # Svelte 5 + Tailwind CSS 4 (webview)
├── server/     # Hono.js routes (serverless)
└── shared/     # Shared TypeScript types
```

Data flow: `User Action → Svelte → fetch('/api/...') → Hono → Redis/Reddit API → Response → UI`

Key packages: Svelte 5.x, Tailwind CSS 4.x, Hono, TypeScript 6.x, Vite 8.x, @devvit/web 0.12.x, Bun

---

## Context Sources

### MCP Tools

Use MCP tools proactively — they give better answers than guessing.

**Svelte MCP:** `list-sections` → `get-documentation` → write code → `svelte-autofixer` (loop until zero issues)

**Devvit MCP:** `devvit_search` for any Devvit/Redis/Reddit API question. Natural language queries work well.

**Sequential Thinking MCP:** `sequentialthinking` for breaking down complex problems into step-by-step reasoning chains. Use when facing multi-step logic, architectural decisions, debugging complex issues, or any task that benefits from structured thinking before acting.

### Web Search

If unsure about an API, library version, or best practice — search the web first. Don't guess. Prefer official docs and recent sources.

---

## Git Conventions

Branches: `feat/...`, `fix/...`, `chore/...`, `refactor/...`

Commits: `type(scope): imperative description` (max 72 chars)

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`
