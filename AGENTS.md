# AGENTS.md

## Build & Development Commands

| Command | Script | Purpose |
|---------|--------|---------|
| `bun install` | - | Install dependencies (auto-runs build via postinstall) |
| `bun run dev` | `concurrently` vite watch + devvit playtest | Start dev server (opens Reddit playtest URL) |
| `bun run build` | `vite build` | Production build to dist/ |
| `bun run type-check` | `tsc --build` | TypeScript composite build check (all 3 projects) |
| `bun run check` | `svelte-check` | Svelte-specific type checking (client only) |
| `bun run test` | `vitest run` | Run all tests (Vitest + @devvit/test) |
| `bun run test:watch` | `vitest` | Watch mode for development |
| `bun run deploy` | `build && devvit upload` | Build and upload to Devvit |
| `bun run launch` | `build && deploy && devvit publish` | Full release pipeline |

**Before committing:**
```bash
bun run test && bun run type-check
```

> **Testing:** Vitest + `@devvit/test` provides in-memory Redis, Reddit API mocks, and per-test
> isolation. Tests live in `__tests__/` directories colocated with source.
> TDD workflow: write failing test → minimal implementation → refactor → `bun run test`.

> **Not yet configured:** No linter (eslint/biome) or formatter (prettier/biome) is installed.
> Do not add these tools without explicit instruction.

---

## Architecture

Devvit app running inside Reddit posts as a sandboxed webview.

```
src/
├── client/           # Svelte 5 + Tailwind CSS 4 (sandboxed webview)
│   ├── App.svelte    # Root component
│   ├── app.css       # @import "tailwindcss"
│   ├── main.ts       # Entry: mount(App, { target })
│   └── index.html    # Entry HTML
├── server/           # Hono.js routes (serverless)
│   ├── __tests__/    # Server tests (Vitest + @devvit/test)
│   ├── index.ts      # Hono app, route handlers, createServer()
│   └── post.ts       # Post creation logic
├── shared/           # Shared TypeScript (project references, no source files yet)
│   └── tsconfig.json
```

Data flow: `User Action → Svelte → fetch('/api/...') → Hono → Redis/Reddit API → Response → UI`

**Key packages:** Svelte 5.x, Tailwind CSS 4.x, Hono, TypeScript 5.x, Vite 8.x-beta, @devvit/web 0.12.x, Bun (package manager)

---

## Coding Principles

These apply to ALL code — server, client, shared. Every skill inherits these rules.

### Functional & minimal
- Pure functions by default: same input → same output, no side effects
- Prefer `map`, `filter`, `reduce` over imperative loops
- No mutation of function arguments — return new values
- Extract logic into small, composable, single-purpose functions (≤30 lines)
- Write the least code that solves the problem — delete what you can
- No dead code, no commented-out code, no "just in case" abstractions
- One function does one thing. If you're naming it `doXAndY`, split it.

### Readability
- Code should read top-to-bottom like a story — put helpers below their callers
- Descriptive names over comments: `getUserScore()` not `getVal() // gets user score`
- Early returns to avoid nesting: guard → bail, then happy path
- Max one level of callback nesting — extract named functions instead
- Comments explain *why*, never *what* (the code shows what)

### Modularity
- Each file has a single clear responsibility
- Shared logic lives in `src/shared/`, server helpers in `src/server/lib/`
- Depend on interfaces/types, not concrete implementations
- No circular imports — if A imports B, B must not import A

### Maintainability
- Explicit over implicit: return types on exports, named constants over magic values
- Fail fast with descriptive errors — never silently swallow failures
- Handle all edge cases: null, undefined, empty arrays, missing keys
- `as const` for literal objects/arrays to preserve type narrowness

---

## Test-Driven Development (TDD)

This project follows strict TDD. Every AI agent and developer must follow these rules.

### The rule: test first, always

1. Before writing any implementation code, check if a corresponding `__tests__/*.test.ts` file exists
2. If not, write the failing test first (Red)
3. Then write the minimal code to make it pass (Green)
4. Then refactor while keeping tests green (Refactor)
5. Run `bun run test` before committing — zero failures required

### Test stack

- **Vitest** as the test runner
- **`@devvit/test`** provides per-test isolated Devvit backend (in-memory Redis, Reddit API mocks, Scheduler, Realtime)
- No manual mock setup needed — `createDevvitTest()` handles everything
- See `.agents/skills/tdd/SKILL.md` for full patterns and code examples

### What must be tested

| Layer | Must test | Can skip tests |
|-------|----------|---------------|
| `src/server/**/*.ts` | All routes, handlers, business logic | — |
| `src/server/lib/**/*.ts` | All helpers, validators, transforms | — |
| `src/shared/**/*.ts` | All pure functions | — |
| `src/client/**/*.ts` | Extracted logic files | `.svelte` files (use autofixer instead) |
| Config / docs / skills | — | Always skip |

### After every implementation task

Run `bun run test` and confirm zero failures before moving to the next task.

---

## Code Style

### TypeScript

- **`strict: true`** with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noUnusedLocals`, `noUnusedParameters`
- Array/object index access returns `T | undefined` — always handle it
- Use `const` by default, `let` only if reassigned, never `var`
- Prefer `unknown` over `any`, then narrow with `instanceof` or type guards
- Use `as const` for literal arrays/objects
- Explicit return types on exported/public functions
- Arrow function expressions for all functions: `const foo = (): void => {}`
- Keep functions ≤30 lines, single responsibility

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
// External packages first, then local. Named imports only.
import { Hono } from 'hono'
import type { Context } from 'hono'            // type-only imports use `import type`
import { context, redis, reddit } from '@devvit/web/server'

// Relative imports for local modules
import { createPost } from './post'
import './app.css'                              // Side-effect imports last

// Svelte files are the ONE exception to "no default exports"
import App from './App.svelte'
```

---

## Git Conventions

**Branches:** `feat/short-description`, `fix/short-description`, `chore/...`, `refactor/...`

**Commits:** `type(scope): imperative description` (max 72 chars)
```
feat(game): add difficulty selector dropdown
fix(timer): stop timer when puzzle completed
chore(deps): update svelte to 5.x
refactor(validation): extract isValidMove function
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`

---

## MCP Tools

Two MCP servers are available. Use them proactively — they give better answers than guessing.

### Svelte MCP (`svelte`)

Use for any Svelte 5 / SvelteKit question, component authoring, or rune usage.

| Tool | When to call |
|------|-------------|
| `list-sections` | First call in any Svelte task — discover available docs |
| `get-documentation` | Fetch full docs for sections identified by `list-sections` |
| `svelte-autofixer` | Run on every Svelte component before finishing — keep calling until zero issues |
| `playground-link` | Only after user asks for one, and only if code was NOT written to a file |

Workflow: `list-sections` → read use_cases → `get-documentation` (all relevant sections at once) → write code → `svelte-autofixer` (loop until clean).

### Devvit MCP (`devvit`)

Use for any Devvit platform question, Redis patterns, Reddit API, config, or constraints.

| Tool | When to call |
|------|-------------|
| `devvit_search` | Search Devvit docs for a specific topic (redis commands, API methods, config options, constraints) |
| `devvit_logs` | Stream logs from a deployed app on a subreddit — useful for debugging live issues |

Prefer `devvit_search` over pasting large doc files into context. It's hybrid search so natural language queries work well (e.g. `"redis sorted set leaderboard"`, `"custom post height options"`).

---

## Research & Clarification

### Use web search when uncertain
- If you're unsure about an API, library version, behavior, or best practice — search the web first
- Don't guess at package APIs, config options, or platform constraints — look them up
- Use web search and web fetch tools proactively for anything outside your confident knowledge
- Prefer official docs and recent sources; cross-reference when results conflict

### Ask questions until ≥90% confident
- Before starting implementation, assess your confidence in the approach
- If confidence is below 90%, ask the user clarifying questions — don't assume
- Cover: expected behavior, edge cases, integration points, constraints, and user preferences
- It's better to ask one extra question than to build the wrong thing
- Once you're ≥90% sure of the requirements and approach, proceed without further delay

