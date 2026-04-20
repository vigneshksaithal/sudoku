---
name: redis-schema
description: Design and implement Redis data storage for a new feature. Use when adding new data models, leaderboards, counters, or any persistent state.
---

# Add Redis Schema

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Available imports

```typescript
// In server route handlers
import { redis } from '@devvit/web/server'

// In test files (preferred by @devvit/test harness)
import { redis } from '@devvit/redis'
```

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

## Supported Redis commands

### Simple read/write

```typescript
await redis.set('key', 'value')
const value = await redis.get('key')           // string | undefined

await redis.exists('key')                       // number (0 or 1)
await redis.del('key')                          // removes key
await redis.type('key')                         // string representation of type
await redis.rename('oldKey', 'newKey')
```

### Numbers

```typescript
await redis.set('counter', '0')
await redis.incrBy('counter', 1)               // returns new value
```

### Batch operations (prefer over multiple round trips)

```typescript
await redis.mSet({ key1: 'val1', key2: 'val2' })
const [a, b] = await redis.mGet(['key1', 'key2'])
```

### Hash (object/record)

```typescript
await redis.hSet('user:t2_abc:stats', { solved: '5', bestTime: '120' })
const stats = await redis.hGetAll('user:t2_abc:stats')  // Record<string, string>
const single = await redis.hGet('user:t2_abc:stats', 'solved')  // string | undefined
```

### Sorted set (leaderboard)

```typescript
await redis.zAdd('leaderboard:wins', { member: 'alice', score: 100 })
const top10 = await redis.zRange('leaderboard:wins', 0, 9, { by: 'rank', reverse: true })
// returns array of { member: string, score: number }
```

### Key expiration

```typescript
await redis.expire('session:abc', 3600)         // seconds
const remaining = await redis.expireTime('key')  // seconds remaining
```

### Transactions

Use `watch`/`multi`/`exec` for atomic operations:

```typescript
const txn = await redis.watch('quantity')

await txn.multi()
await txn.incrBy('karma', 10)
await txn.set('name', 'Devvit')
await txn.exec()                                // executes atomically

// Or discard:
// await txn.discard()
```

Transaction limits: max 20 concurrent per installation, 5-second execution timeout.

## Platform limits

| Limit | Value |
|---|---|
| Max commands/second | 40,000 |
| Max request size | 5 MB |
| Max storage per installation | 500 MB |
| Pipelining | Not supported |
| Key listing | Not supported |
| Lua scripts | Not supported |
| Sets | Only sorted sets supported |

- Prefer `hGetAll` over multiple `hGet` calls
- Prefer `mGet` / `mSet` over multiple `get` / `set` calls

## Null safety (noUncheckedIndexedAccess is on)

```typescript
const value = await redis.get('key')
if (value === undefined) {
  // handle missing key — don't assume it exists
}

const stats = await redis.hGetAll('user:t2_abc:stats')
const solved = stats['solved']  // string | undefined — must check
if (solved !== undefined) {
  const count = parseInt(solved, 10)
}
```

## Cache helper (for shared read-heavy data)

For data that many clients read simultaneously (scores, tickers):

```typescript
import { cache } from '@devvit/web/server'

const data = await cache('leaderboard-top10', async () => {
  // This fetch runs at most once per TTL period
  const top = await redis.zRange('leaderboard:wins', 0, 9, { by: 'rank', reverse: true })
  return JSON.stringify(top)
}, 30) // TTL in seconds for Devvit Web
```

## Checklist before finishing
- [ ] Tests written FIRST in `__tests__/` using `@devvit/test` with in-memory Redis
- [ ] Keys follow `{entity}:{id}:{field}` pattern
- [ ] All Redis values are strings — parse numbers with `parseInt`/`parseFloat`
- [ ] Null/undefined handled after every `get` / `hGet`
- [ ] Batch reads used where multiple keys needed
- [ ] Expiration set on ephemeral data (sessions, temp state)
- [ ] Transactions used for multi-step atomic operations
- [ ] Total storage estimate documented if significant
- [ ] `bun run test` passes with zero failures
