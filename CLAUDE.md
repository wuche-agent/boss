# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start               # run the bot (ts-node src/index.ts)
npm test                # run all tests
npm run test:watch      # run tests in watch mode

# Run a single test file
npx jest tests/llm.test.ts

# Start all dependencies (Redis + Hermes profiles) then launch the bot
./scripts/start.sh

# One-time: pull Hermes credentials from ~/.hermes/profiles/pm/auth.json into .env
python3 scripts/setup-hermes-env.py
```

No lint script is configured — TypeScript type checking runs implicitly via `ts-jest`.

## Required Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|---|---|
| `DINGTALK_APP_KEY` / `DINGTALK_APP_SECRET` | App credentials for DingTalk Stream client |
| `DINGTALK_ROBOT_CODE` | Robot code used when sending messages |
| `BOSS_USER_IDS` | Comma-separated staffIds allowed to use the bot; empty = open to all |
| `HERMES_BASE_URL` | OpenAI-compatible endpoint for the LLM (defaults to `http://localhost:11434/v1`) |
| `HERMES_MODEL` | Model name passed to the LLM API |
| `HERMES_API_KEY` | API key for Hermes (not in `.env.example`; set by `setup-hermes-env.py`) |
| `REDIS_URL` | Redis connection string |
| `BITABLE_APP_TOKEN` / `BITABLE_TABLE_ID` | DingTalk Bitable table for task records |

## Architecture

The bot is a **DingTalk Stream** long-poll client (no webhook server needed). It handles two event types:

- **`TOPIC_ROBOT`** — incoming chat messages from the boss user
- **`todo.task.finish`** — DingTalk todo completion events

### Conversation flow

1. **`router.ts`** — gates every message: checks `BOSS_USER_IDS` whitelist; in group chats only passes @-mentions.
2. **`conversation.ts`** — manages per-user session state in Redis (30-min TTL). States: `clarifying` → `awaiting_confirm` → (cleared on completion). A session holds the full conversation history and an optional `PendingTask`.
3. **`llm.ts`** — calls the Hermes LLM (OpenAI-compatible) with the system prompt plus full conversation history. When the model has gathered enough information it appends `<<<TASK_READY>>>` followed by a JSON blob; `conductConversation` splits on this marker to extract the structured task.
4. **`executor.ts`** — triggered after the boss confirms. Orchestrates five sequential steps:
   1. Resolve assignee staffId by name via DingTalk contact search (`dingtalk/user.ts`)
   2. Send a markdown card to the assignee (`dingtalk/message.ts:sendCard`)
   3. Create a DingTalk todo task (`dingtalk/todo.ts`)
   4. Insert a row in the Bitable table (`dingtalk/bitable.ts`)
   5. Store `todo:<taskId>` → `{ rowId, bossUserId, summary }` in Redis (30-day TTL) for completion tracking
5. **`events/todoComplete.ts`** — on `todo.task.finish`, looks up the Redis mapping, updates the Bitable row status to `已完成`, and notifies the boss.

### `src/dingtalk/` wrappers

All DingTalk REST calls share a single in-process token cache (`client.ts:getAccessToken`). The token is refreshed when fewer than 60 seconds remain. Each wrapper (`message`, `todo`, `bitable`, `user`) uses `x-acs-dingtalk-access-token` header authentication.

### Hermes (local LLM gateway)

`scripts/start.sh` starts multiple Hermes profiles on fixed ports (e.g. `pm` on 8647) then sets `HERMES_BASE_URL` in `.env` accordingly. The assistant uses the `pm` profile by default. The system prompt (`src/prompts/system.ts`) instructs the model to act as a strategic advisor, ask one question at a time, and emit the `<<<TASK_READY>>>` marker only when all required fields are collected.

## Testing

Tests live in `tests/` and mirror the `src/` structure. External dependencies (Redis via `ioredis`, OpenAI SDK, axios) are mocked at the module level with `jest.mock(...)`. No integration tests require live services.
