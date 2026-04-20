---
name: devvit-config
description: Modify devvit.json to add menu items, triggers, scheduler tasks, forms, permissions, or post entrypoints. Use when wiring new server endpoints to Reddit UI actions.
---

# Update Devvit Config

> All code must follow the **Coding Principles** in AGENTS.md (functional, minimal, readable, modular).

## devvit.json structure

```jsonc
{
  "$schema": "https://developers.reddit.com/schema/config-file.v1.json",
  "name": "app-name",
  "post": {
    "dir": "dist/client",
    "entrypoints": {
      "default": {
        "entry": "index.html",
        "height": "tall",       // "short" | "regular" | "tall"
        "inline": true          // renders inside post feed, not popup
      }
    }
  },
  "server": {
    "dir": "dist/server",
    "entry": "index.cjs"
  },
  "permissions": { ... },
  "menu": { ... },
  "triggers": { ... },
  "scheduler": { ... },
  "forms": { ... },
  "payments": { ... },
  "marketingAssets": { ... },
  "scripts": { ... },
  "dev": { ... }
}
```

## Required properties

- **`name`** (required): 3-16 chars, lowercase letters/numbers/hyphens, starts with a letter.
- At least one of `post`, `server`, or `blocks` must be present.

## Adding a menu item

Menu items appear in Reddit's "..." menu on posts or subreddits. Each maps to an `/internal/menu/*` endpoint.

```json
{
  "menu": {
    "items": [
      {
        "label": "Human-readable label",
        "description": "Tooltip text",
        "location": "subreddit",
        "forUserType": "moderator",
        "endpoint": "/internal/menu/action-name"
      }
    ]
  }
}
```

| Field | Values | Notes |
|-------|--------|-------|
| `location` | `"subreddit"`, `"post"`, `"comment"` | Where the menu item appears |
| `forUserType` | `"moderator"`, `"member"` | Who can see it |
| `endpoint` | `/internal/menu/{name}` | Must match a Hono route |

After adding a menu item, create the matching Hono handler:

```typescript
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared'

app.post('/internal/menu/action-name', async (c) => {
  const _input = await c.req.json<MenuItemRequest>()
  // handler logic
  return c.json<UiResponse>({ status: 'ok' })
})
```

### Menu response patterns

Menu handlers can return rich responses via `UiResponse`:

```typescript
// Show a toast
return c.json<UiResponse>({ showToast: 'Action completed!' })

// Navigate to a post
return c.json<UiResponse>({
  navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
})

// Show a form (requires forms config)
return c.json<UiResponse>({
  showForm: {
    name: 'myForm',
    form: { fields: [{ type: 'string', name: 'input', label: 'Enter value' }] },
    data: { input: 'default' }  // optional pre-populated values
  }
})
```

## Adding triggers

Triggers fire on platform events. Each maps to an `/internal/*` endpoint.

```json
{
  "triggers": {
    "onAppInstall": "/internal/on-app-install",
    "onPostCreate": "/internal/on-post-create",
    "onCommentCreate": "/internal/on-comment-create"
  }
}
```

### All supported triggers

| Trigger | Fires when |
|---------|-----------|
| `onAppInstall` | App installed on a subreddit |
| `onAppUpgrade` | App updated to new version |
| `onPostSubmit` | Post submitted (before processing) |
| `onPostCreate` | Post created (after processing) |
| `onPostUpdate` | Post edited |
| `onPostDelete` | Post deleted |
| `onPostReport` | Post reported |
| `onPostFlairUpdate` | Post flair changed |
| `onPostNsfwUpdate` | Post NSFW status changed |
| `onPostSpoilerUpdate` | Post spoiler status changed |
| `onCommentSubmit` | Comment submitted (before processing) |
| `onCommentCreate` | Comment created (after processing) |
| `onCommentUpdate` | Comment edited |
| `onCommentDelete` | Comment deleted |
| `onCommentReport` | Comment reported |
| `onModActions` | Moderator action taken |
| `onModMail` | Modmail received |
| `onAutomoderatorFilterPost` | Automod filters a post |
| `onAutomoderatorFilterComment` | Automod filters a comment |

### Typed trigger handlers

```typescript
import type {
  OnPostSubmitRequest,
  OnCommentCreateRequest,
  OnAppUpgradeRequest,
  TriggerResponse,
} from '@devvit/web/shared'

app.post('/internal/on-post-submit', async (c) => {
  const input = await c.req.json<OnPostSubmitRequest>()
  const post = input.post
  const author = input.author
  console.log('Post:', JSON.stringify(post, null, 2))
  return c.json<TriggerResponse>({ status: 'ok' })
})
```

## Adding scheduler tasks

Scheduler supports cron-based recurring jobs and one-off jobs.

```json
{
  "scheduler": {
    "tasks": {
      "daily-cleanup": {
        "endpoint": "/internal/cron/daily-cleanup",
        "cron": "0 2 * * *"
      },
      "hourly-check": {
        "endpoint": "/internal/cron/hourly-check",
        "cron": "0 * * * *",
        "data": { "checkType": "health" }
      },
      "manual-task": "/internal/cron/manual-task"
    }
  }
}
```

- `endpoint` (string): Internal endpoint to call (required)
- `cron` (string): Standard 5-part or 6-part cron format (optional, for recurring)
- `data` (object): Additional data passed to cron tasks (optional)
- Tasks without `cron` are one-off — scheduled at runtime via `scheduler.runJob()`

Handler:

```typescript
import type { TaskRequest, TaskResponse } from '@devvit/web/server'

app.post('/internal/cron/daily-cleanup', async (c) => {
  const _input = await c.req.json<TaskRequest>()
  // cleanup logic
  return c.json<TaskResponse>({ status: 'ok' })
})
```

Limits: 10 live recurring actions per installation, 60 `runJob()` calls/minute, 60 deliveries/minute.

## Adding forms

Map form identifiers to submission endpoints (used with menu response forms):

```json
{
  "forms": {
    "contact_form": "/internal/forms/contact",
    "feedback_form": "/internal/forms/feedback"
  }
}
```

## Permissions

```json
{
  "permissions": {
    "redis": true,
    "http": {
      "enable": true,
      "domains": ["api.example.com"]
    },
    "media": true,
    "payments": true,
    "reddit": {
      "asUser": ["SUBMIT_POST", "SUBMIT_COMMENT", "SUBSCRIBE_TO_SUBREDDIT"]
    }
  }
}
```

| Permission | When needed |
|---|---|
| `redis` | Using Redis for data storage |
| `http` | Making external HTTP requests (list specific domains) |
| `media` | Uploading images via `media.upload()` |
| `payments` | In-app purchases |
| `reddit.asUser` | Submitting posts/comments as the user (requires app approval) |

## Payments configuration

```json
{
  "payments": {
    "productsFile": "./products.json",
    "endpoints": {
      "fulfillOrder": "/internal/payments/fulfill",
      "refundOrder": "/internal/payments/refund"
    }
  }
}
```

## Scripts configuration

Commands run by the Devvit CLI during `devvit playtest` and `devvit upload`:

```json
{
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build"
  }
}
```

## Marketing assets

```json
{
  "marketingAssets": {
    "icon": "assets/icon.png"
  }
}
```

Icon must be 1024x1024 PNG.

## Post height options

| Height | Use case |
|--------|----------|
| `"short"` | Simple widgets, counters |
| `"regular"` | Cards, small games |
| `"tall"` | Full games, complex UI |

## Multiple entry points

```json
{
  "post": {
    "dir": "dist/client",
    "entrypoints": {
      "default": {
        "entry": "src/client/preview.html",
        "height": "regular",
        "inline": true
      },
      "game": {
        "entry": "src/client/game.html"
      },
      "leaderboard": {
        "entry": "src/client/leaderboard.html"
      }
    }
  }
}
```

Use `entry` parameter in `submitCustomPost()` to target a specific entrypoint. Use `requestExpandedMode(event, 'game')` on the client to switch entrypoints.

## Development configuration

```json
{
  "dev": {
    "subreddit": "my-test-sub"
  }
}
```

Can be overridden by `DEVVIT_SUBREDDIT` env var.

## Checklist before finishing
- [ ] Tests written FIRST for corresponding server handlers in `src/server/__tests__/`
- [ ] Menu item `endpoint` matches a Hono route in `src/server/index.ts`
- [ ] Trigger endpoint matches a Hono route
- [ ] Scheduler task endpoint matches a Hono route
- [ ] `location` and `forUserType` are appropriate for the action
- [ ] Endpoint paths follow `/internal/menu/*`, `/internal/on-*`, or `/internal/cron/*` convention
- [ ] Corresponding server handler exists and handles errors
- [ ] Typed request/response types imported from `@devvit/web/shared`
- [ ] Required permissions added for features used
- [ ] `bun run test` passes with zero failures
