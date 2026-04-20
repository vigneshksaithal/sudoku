---
name: settings-secrets
description: Add app settings and secrets for configuration. Use when adding API keys, feature toggles, moderator-configurable options, or any per-installation configuration.
---

# Settings and Secrets

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## Reading settings (server-side)

```typescript
import { settings } from '@devvit/web/server'

const apiKey = await settings.get('openaiApiKey')
const model = await settings.get('aiModel')

// Batch read
const [key, model, tokens] = await Promise.all([
  settings.get('openaiApiKey'),
  settings.get('aiModel'),
  settings.get('maxTokens'),
])
```

## Defining settings in devvit.json

Settings are defined using `Devvit.addSettings()` in blocks-based code. For Devvit Web apps, settings configuration is typically done in a blocks entry point or via the CLI.

### Setting scopes

| Scope | Who sets it | Visibility |
|---|---|---|
| `app` | App developer (via CLI) | Global across all installations |
| `installation` | Moderator (via Install Settings UI) | Per-subreddit |

### Secret settings

Secrets (`isSecret: true`) can only be `app` scope and are set via CLI by the developer. They are never exposed to moderators or users.

## Limits

- Max 2KB per setting value

## Testing

```typescript
import { createDevvitTest } from '@devvit/test/server/vitest'
import { settings } from '@devvit/web/server'
import { expect } from 'vitest'

const test = createDevvitTest({
  settings: {
    'apiKey': 'test-key-123',
    'maxTokens': '500',
  },
})

test('reads settings', async () => {
  const key = await settings.get('apiKey')
  expect(key).toBe('test-key-123')
})
```

## Checklist before finishing
- [ ] Tests written FIRST with settings configured in `createDevvitTest()`
- [ ] Secret values never logged or returned to client
- [ ] Settings read server-side only
- [ ] `bun run test` passes with zero failures
