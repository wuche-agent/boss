# Task Execution Flow Design

**Goal:** After the boss confirms a task, execute a 5-step sequence: resolve assignee staffId → send markdown card → create DingTalk todo → insert bitable row → confirm to boss.

**Architecture:** Sequential execution in `executor.ts`. Each step depends on the previous (staffId needed for card and todo; taskId from todo needed for bitable). Failure at any step aborts and reports error to boss.

**Tech Stack:** DingTalk REST API v1.0, axios, existing `getAccessToken()` auth client.

---

## Execution Flow

```
Boss replies "确认"
    │
    ▼
① searchUserByName(assignee_name)
   GET /v1.0/contact/users/search?queryWord=<name>&offset=0&size=5
   → exact name match first, fallback to first result
   → throws if not found (contact permission must be enabled)
    │
    ▼
② sendCard(staffId, { goal, detail, deadline, bossName })
   POST /v1.0/robot/oToMessages/batchSend
   msgKey = "sampleMarkdown"
   text = markdown card (see format below)
    │
    ▼
③ createTodo(staffId, { subject: detail, dueTime: deadline })
   POST /v1.0/todo/users/{staffId}/tasks
   → returns taskId
    │
    ▼
④ insertTaskRecord({ detail, assigneeName, assigneeUserId, deadline, taskId, bossUserId })
   POST bitable append row
    │
    ▼
⑤ sendMessage(bossUserId, "✅ 任务已创建并通知到{assigneeName}：\n{summary}")
```

---

## Card Format (sampleMarkdown)

```
### 你有一个新任务 📋
**目标：** {goal}
**内容：** {detail}
**截止日期：** {deadline}
**来自：** {bossName}
```

---

## File Changes

### `src/dingtalk/message.ts`
Add `sendCard(userId, card)` function alongside existing `sendMessage()`.

```typescript
export interface TaskCard {
  goal: string;
  detail: string;
  deadline: string;
  bossName: string;
}

export async function sendCard(userId: string, card: TaskCard): Promise<void>
```

Uses the same `/v1.0/robot/oToMessages/batchSend` endpoint with:
```json
{
  "msgKey": "sampleMarkdown",
  "msgParam": "{\"title\":\"你有一个新任务\",\"text\":\"### 你有一个新任务 📋\\n**目标：** ...\"}",
  "userIds": ["{userId}"],
  "robotCode": "{DINGTALK_ROBOT_CODE}"
}
```

### `src/dingtalk/user.ts`
Remove silent try/catch. `searchUserByName` throws on any failure: API error (403 = contact permission not enabled) or no matching user found. Never returns `null`; return type is `string` (staffId).

### `src/executor.ts`
Replace current flow with the 5-step sequence above. Use `sendCard()` instead of `sendMessage()` for the assignee notification. Remove the silent fallback path (if user not found, throw — the LLM collected this name from the conversation so it should always exist in the org).

---

## Error Handling

- **Search returns null** (user not in org): throw with message "未找到用户 {name}"
- **Search throws 403**: throw — contact permission must be enabled by admin
- **Card / todo / bitable fails**: throw — caught in `index.ts`, reports ❌ to boss with retry prompt

---

## Permissions Required

| API | Permission scope |
|-----|-----------------|
| Contact search | `Contact.User.Read` (通讯录只读) |
| Send message | Already enabled (robot message) |
| Create todo | `Todo.Task.Write` |
| Bitable write | Already enabled |
