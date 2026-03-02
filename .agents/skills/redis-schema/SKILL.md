---
name: add-redis-schema
description: Design and implement Redis data storage for a new feature. Use when adding new data models, leaderboards, counters, or any persistent state.
---

# Add Redis Schema

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Key naming convention (always colon-delimited)

```
{entity}:{identifier}:{attribute}
```

| Use case | Pattern | Example |
|---|---|---|
| Game state | `game:{postId}:state` | `game:t3_abc:state` |
| User stats | `user:{userId}:stats` | `user:t2_xyz:stats` |
| Per-game user data | `user:{userId}:game:{postId}` | `user:t2_xyz:game:t3_abc` |
| Leaderboard | `leaderboard:{scope}:{timeframe}` | `leaderboard:wins:daily` |
| Global counter | `stats:{metric}` | `stats:totalGames` |

## Common Redis operations

```typescript
import { redis } from '@devvit/web/server'

// String (simple values, flags)
await redis.set('key', 'value')
const value = await redis.get('key')           // string | null

// Numbers
await redis.incrBy('counter', 1)

// Hash (object/record)
await redis.hSet('user:t2_abc:stats', { solved: '5', bestTime: '120' })
const stats = await redis.hGetAll('user:t2_abc:stats')  // Record<string, string>

// Sorted set (leaderboard)
await redis.zAdd('leaderboard:wins', { member: 'alice', score: 100 })
const top10 = await redis.zRange('leaderboard:wins', 0, 9, { by: 'score', reverse: true })

// Expiration
await redis.expire('session:abc', 3600)  // seconds

// Batch reads (prefer over multiple round trips)
const [a, b] = await redis.mGet(['key1', 'key2'])
```

## Platform limits to design around
- 500MB total storage per subreddit install
- 1,000 commands/second max
- 4MB max request payload
- Prefer `hGetAll` over multiple `hGet` calls
- Prefer `mGet` over multiple `get` calls

## Null safety (noUncheckedIndexedAccess is on)

```typescript
const value = await redis.get('key')
if (value === null) {
  // handle missing key — don't assume it exists
}

const stats = await redis.hGetAll('user:t2_abc:stats')
const solved = stats['solved']  // string | undefined — must check
if (solved !== undefined) {
  const count = parseInt(solved, 10)
}
```

## Checklist before finishing
- [ ] Tests written FIRST in `__tests__/` using `bun:test` and devvit-mocks for Redis operations
- [ ] Keys follow `{entity}:{id}:{field}` pattern
- [ ] All Redis values are strings — parse numbers with `parseInt`/`parseFloat`
- [ ] Null/undefined handled after every `get` / `hGet`
- [ ] Batch reads used where multiple keys needed
- [ ] Expiration set on ephemeral data (sessions, temp state)
- [ ] Total storage estimate documented if significant
- [ ] `bun run test` passes with zero failures
