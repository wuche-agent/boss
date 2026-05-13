# Task Execution Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the boss confirms a task, resolve the assignee's DingTalk staffId by name, send them a markdown card, create a todo, insert into bitable, then confirm to boss.

**Architecture:** Three files change: `message.ts` gains `sendCard()`, `user.ts` becomes throw-on-failure, `executor.ts` is rewritten with the new 5-step sequential flow. `index.ts` gets one field added (`goal`). TDD throughout.

**Tech Stack:** TypeScript, axios, DingTalk REST API v1.0, Jest

---

## File Map

| File | Change |
|------|--------|
| `src/dingtalk/message.ts` | Add `sendCard(userId, card)` + `TaskCard` interface |
| `src/dingtalk/user.ts` | Return type `string` (throws instead of null), remove try/catch |
| `src/executor.ts` | Rewrite: remove fallback path, add `goal` to `TaskParams`, use `sendCard` |
| `src/index.ts` | Add `goal: task.goal` to `executeTask()` call, remove `assigneeUserId` |
| `tests/dingtalk/message.test.ts` | Add `sendCard` tests |
| `tests/dingtalk/user.test.ts` | New file: `searchUserByName` tests |
| `tests/executor.test.ts` | Update: mock `searchUserByName` + `sendCard`, add `goal` field |

---

## Task 1: Add `sendCard()` to message.ts

**Files:**
- Modify: `src/dingtalk/message.ts`
- Modify: `tests/dingtalk/message.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/dingtalk/message.test.ts`:

```typescript
import { sendMessage, sendCard, TaskCard } from '../../src/dingtalk/message';

// (keep existing sendMessage describe block, add below)

describe('sendCard', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
    mockedAxios.post.mockResolvedValue({ data: {} });
  });

  it('sends a markdown card to a single user', async () => {
    const card: TaskCard = {
      goal: '提升销售效率',
      detail: '完成Q2季度销售报告',
      deadline: '2026-05-18',
      bossName: '武彻',
    };
    await sendCard('user_123', card);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
      {
        robotCode: process.env.DINGTALK_ROBOT_CODE,
        userIds: ['user_123'],
        msgKey: 'sampleMarkdown',
        msgParam: JSON.stringify({
          title: '你有一个新任务',
          text: '### 你有一个新任务 📋\n**目标：** 提升销售效率\n**内容：** 完成Q2季度销售报告\n**截止日期：** 2026-05-18\n**来自：** 武彻',
        }),
      },
      { headers: { 'x-acs-dingtalk-access-token': 'mock_token' } }
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/wuche/Workspace/AI-team/dingtalk-ai-assistant
npx jest tests/dingtalk/message.test.ts --no-coverage 2>&1 | tail -10
```

Expected: FAIL — `sendCard` is not exported from `'../../src/dingtalk/message'`

- [ ] **Step 3: Implement `sendCard` in message.ts**

Replace the entire `src/dingtalk/message.ts` with:

```typescript
import axios from 'axios';
import { getAccessToken } from './client';

export async function sendMessage(userId: string, content: string): Promise<void> {
  const token = await getAccessToken();
  await axios.post(
    'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
    {
      robotCode: process.env.DINGTALK_ROBOT_CODE,
      userIds: [userId],
      msgKey: 'sampleText',
      msgParam: JSON.stringify({ content }),
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}

export interface TaskCard {
  goal: string;
  detail: string;
  deadline: string;
  bossName: string;
}

export async function sendCard(userId: string, card: TaskCard): Promise<void> {
  const token = await getAccessToken();
  const text =
    `### 你有一个新任务 📋\n` +
    `**目标：** ${card.goal}\n` +
    `**内容：** ${card.detail}\n` +
    `**截止日期：** ${card.deadline}\n` +
    `**来自：** ${card.bossName}`;
  await axios.post(
    'https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend',
    {
      robotCode: process.env.DINGTALK_ROBOT_CODE,
      userIds: [userId],
      msgKey: 'sampleMarkdown',
      msgParam: JSON.stringify({ title: '你有一个新任务', text }),
    },
    { headers: { 'x-acs-dingtalk-access-token': token } }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest tests/dingtalk/message.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/dingtalk/message.ts tests/dingtalk/message.test.ts
git commit -m "feat: add sendCard() markdown card function"
```

---

## Task 2: Update `searchUserByName` to throw instead of return null

**Files:**
- Modify: `src/dingtalk/user.ts`
- Create: `tests/dingtalk/user.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/dingtalk/user.test.ts`:

```typescript
import axios from 'axios';
import { searchUserByName } from '../../src/dingtalk/user';
import * as client from '../../src/dingtalk/client';

jest.mock('axios');
jest.mock('../../src/dingtalk/client');
const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedClient = client as jest.Mocked<typeof client>;

describe('searchUserByName', () => {
  beforeEach(() => {
    mockedClient.getAccessToken.mockResolvedValue('mock_token');
  });

  it('returns staffId when exact name match is found', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'staff_001', name: '洋子老师' }] },
    });
    const id = await searchUserByName('洋子老师');
    expect(id).toBe('staff_001');
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.dingtalk.com/v1.0/contact/users/search',
      {
        params: { queryWord: '洋子老师', offset: 0, size: 5 },
        headers: { 'x-acs-dingtalk-access-token': 'mock_token' },
      }
    );
  });

  it('returns first result when no exact name match', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { list: [{ userId: 'staff_002', name: '洋子' }] },
    });
    const id = await searchUserByName('洋子老师');
    expect(id).toBe('staff_002');
  });

  it('throws when list is empty', async () => {
    mockedAxios.get.mockResolvedValue({ data: { list: [] } });
    await expect(searchUserByName('不存在的人')).rejects.toThrow('未找到用户');
  });

  it('throws when API returns 403', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Request failed with status code 403'));
    await expect(searchUserByName('洋子老师')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/dingtalk/user.test.ts --no-coverage 2>&1 | tail -15
```

Expected: FAIL — the "throws when list is empty" test fails because current code returns `null` instead of throwing.

- [ ] **Step 3: Update `user.ts`**

Replace `src/dingtalk/user.ts` with:

```typescript
import axios from 'axios';
import { getAccessToken } from './client';

export async function searchUserByName(name: string): Promise<string> {
  const token = await getAccessToken();
  const response = await axios.get('https://api.dingtalk.com/v1.0/contact/users/search', {
    params: { queryWord: name, offset: 0, size: 5 },
    headers: { 'x-acs-dingtalk-access-token': token },
  });

  const list = (response.data as { list?: { userId: string; name: string }[] }).list ?? [];
  const match = list.find(u => u.name === name) ?? list[0];
  if (!match) throw new Error(`未找到用户"${name}"，请确认通讯录中存在该成员`);
  return match.userId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/dingtalk/user.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 4 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/dingtalk/user.ts tests/dingtalk/user.test.ts
git commit -m "feat: searchUserByName throws on not-found instead of returning null"
```

---

## Task 3: Rewrite `executor.ts` with new 5-step flow

**Files:**
- Modify: `src/executor.ts`
- Modify: `tests/executor.test.ts`

The new `TaskParams` drops `assigneeUserId` (always resolved via name), adds `goal`.

New execution order: search → sendCard → createTodo → insertTaskRecord → redis.set → sendMessage(boss).

- [ ] **Step 1: Update the executor test**

Replace `tests/executor.test.ts` with:

```typescript
import { executeTask } from '../src/executor';
import * as message from '../src/dingtalk/message';
import * as todo from '../src/dingtalk/todo';
import * as bitable from '../src/dingtalk/bitable';
import * as user from '../src/dingtalk/user';

jest.mock('../src/dingtalk/message');
jest.mock('../src/dingtalk/todo');
jest.mock('../src/dingtalk/bitable');
jest.mock('../src/dingtalk/user');

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    get: jest.fn(async (key: string) => {
      const s = (global as Record<string, unknown>).__ioredisStore as Record<string, string> | undefined;
      return s?.[key] ?? null;
    }),
    set: jest.fn(async (key: string, value: string) => {
      const s = (global as Record<string, unknown>).__ioredisStore as Record<string, string> | undefined;
      if (s) s[key] = value;
    }),
    del: jest.fn(async (key: string) => {
      const s = (global as Record<string, unknown>).__ioredisStore as Record<string, string> | undefined;
      if (s) delete s[key];
    }),
  }))
);

const mockedMessage = message as jest.Mocked<typeof message>;
const mockedTodo = todo as jest.Mocked<typeof todo>;
const mockedBitable = bitable as jest.Mocked<typeof bitable>;
const mockedUser = user as jest.Mocked<typeof user>;

describe('executeTask', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as Record<string, unknown>).__ioredisStore = {};
    mockedUser.searchUserByName.mockResolvedValue('staff_789');
    mockedTodo.createTodo.mockResolvedValue('todo_abc');
    mockedBitable.insertTaskRecord.mockResolvedValue('row_xyz');
    mockedMessage.sendCard.mockResolvedValue(undefined);
    mockedMessage.sendMessage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete (global as Record<string, unknown>).__ioredisStore;
  });

  it('resolves staffId, sends card, creates todo, inserts bitable, stores redis, confirms boss', async () => {
    await executeTask({
      bossUserId: 'boss_001',
      bossName: '老板',
      assigneeName: '小王',
      goal: '提升销售效率',
      detail: '完成Q2报告',
      deadline: '2026-05-20',
      summary: '小王需在5月20日前完成Q2报告',
    });

    expect(mockedUser.searchUserByName).toHaveBeenCalledWith('小王');

    expect(mockedMessage.sendCard).toHaveBeenCalledWith('staff_789', {
      goal: '提升销售效率',
      detail: '完成Q2报告',
      deadline: '2026-05-20',
      bossName: '老板',
    });

    expect(mockedTodo.createTodo).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeUserId: 'staff_789', subject: '完成Q2报告' })
    );

    expect(mockedBitable.insertTaskRecord).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 'todo_abc', assigneeUserId: 'staff_789' })
    );

    const redisStore = (global as Record<string, unknown>).__ioredisStore as Record<string, string>;
    expect(redisStore['todo:todo_abc']).toBe(
      JSON.stringify({ rowId: 'row_xyz', bossUserId: 'boss_001', summary: '小王需在5月20日前完成Q2报告' })
    );

    expect(mockedMessage.sendMessage).toHaveBeenCalledWith(
      'boss_001',
      expect.stringContaining('已创建')
    );
  });

  it('throws and does NOT send card if searchUserByName throws', async () => {
    mockedUser.searchUserByName.mockRejectedValue(new Error('未找到用户'));
    await expect(
      executeTask({
        bossUserId: 'boss_001',
        bossName: '老板',
        assigneeName: '不存在的人',
        goal: '目标',
        detail: '内容',
        deadline: '2026-05-20',
        summary: '摘要',
      })
    ).rejects.toThrow('未找到用户');
    expect(mockedMessage.sendCard).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest tests/executor.test.ts --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `sendCard` not found on message mock, `goal` field missing from `TaskParams`

- [ ] **Step 3: Rewrite `executor.ts`**

Replace `src/executor.ts` with:

```typescript
import { redis } from './redis';
import { sendMessage, sendCard } from './dingtalk/message';
import { createTodo } from './dingtalk/todo';
import { insertTaskRecord } from './dingtalk/bitable';
import { searchUserByName } from './dingtalk/user';

export interface TaskParams {
  bossUserId: string;
  bossName: string;
  assigneeName: string;
  goal: string;
  detail: string;
  deadline: string;
  summary: string;
}

export async function executeTask(params: TaskParams): Promise<void> {
  // 1) Resolve assignee staffId
  const assigneeUserId = await searchUserByName(params.assigneeName);
  console.log(`[executor] resolved ${params.assigneeName} → ${assigneeUserId}`);

  // 2) Send markdown card to assignee
  await sendCard(assigneeUserId, {
    goal: params.goal,
    detail: params.detail,
    deadline: params.deadline,
    bossName: params.bossName,
  });

  // 3) Create DingTalk todo
  const taskId = await createTodo({
    assigneeUserId,
    creatorUserId: params.bossUserId,
    subject: params.detail,
    dueTime: params.deadline,
  });

  // 4) Insert bitable row
  const rowId = await insertTaskRecord({
    detail: params.detail,
    assigneeName: params.assigneeName,
    assigneeUserId,
    deadline: params.deadline,
    taskId,
    bossUserId: params.bossUserId,
  });

  // 5) Store Redis mapping (TTL: 30 days)
  await redis.set(
    `todo:${taskId}`,
    JSON.stringify({ rowId, bossUserId: params.bossUserId, summary: params.summary }),
    'EX',
    30 * 24 * 60 * 60
  );

  // 6) Confirm to boss
  await sendMessage(
    params.bossUserId,
    `✅ 任务已创建并通知到${params.assigneeName}：\n${params.summary}`
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest tests/executor.test.ts --no-coverage 2>&1 | tail -10
```

Expected: PASS — 2 tests passing

- [ ] **Step 5: Commit**

```bash
git add src/executor.ts tests/executor.test.ts
git commit -m "feat: rewrite executor with card message and contact search"
```

---

## Task 4: Update `index.ts` call site

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Update the `executeTask` call in `index.ts`**

Find the `executeTask({...})` block (around line 57) and replace it with:

```typescript
await executeTask({
  bossUserId: userId,
  bossName: event.senderNick ?? '老板',
  assigneeName: task.assignee_name,
  goal: task.goal,
  detail: task.detail,
  deadline: task.deadline,
  summary: task.summary,
});
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```

Expected: All tests pass (the old `assigneeUserId` field is gone from `TaskParams`, TypeScript will error if it's still referenced anywhere)

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: pass goal to executeTask, remove assigneeUserId placeholder"
```

---

## Task 5: Full test suite verification

- [ ] **Step 1: Run all tests**

```bash
cd /Users/wuche/Workspace/AI-team/dingtalk-ai-assistant
npm test 2>&1 | tail -15
```

Expected:
```
Test Suites: 9 passed, 9 total
Tests:       XX passed, XX total
```

- [ ] **Step 2: TypeScript compile check**

```bash
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors)
