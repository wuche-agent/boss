# DingTalk AI Boss Assistant

一个运行在钉钉里的 AI 老板助理，用来把老板的模糊想法收敛成清晰任务，并持续巡检任务进度。

## V1 能力

- 通过多轮对话把老板想法整理成标准任务草案
- 草案字段固定为：负责人 / 任务内容 / 任务目的 / 截止时间 / 交付物
- 老板确认后，先写入钉钉多维表，再同步创建钉钉待办
- 根据负责人姓名搜索钉钉组织架构，并回填部门信息
- 同事完成待办后，自动回写多维表状态并通知老板
- 支持老板主动巡检任务
- 支持定时给老板推送任务摘要

## 任务闭环

1. 老板在钉钉单聊或群聊 `@` 助理
2. 助理补齐任务关键字段
3. 助理输出待确认草案
4. 老板回复 `确认`
5. 系统创建多维表主任务记录
6. 系统创建负责人钉钉待办并发送任务卡片
7. 同事完成待办后，系统回写状态并通知老板

## 巡检能力

老板可以直接提问，例如：

- `今天有哪些任务快到期？`
- `谁的任务还没完成？`
- `市场部还有哪些进行中的任务？`
- `最近完成了哪些任务？`

系统会把这些问题解析成结构化查询，再从多维表里取数并组织回复。

## 运行前准备

需要准备以下外部能力：

- 一个钉钉 Stream 模式机器人应用
- 钉钉待办写入权限
- 钉钉通讯录搜索权限
- 一个用于保存任务主数据的钉钉多维表
- Redis
- 一个兼容 OpenAI API 的 LLM 网关，默认按仓库脚本使用本地 Hermes

## 快速开始

### 1. 安装依赖

```bash
npm install
```

如果本机 `~/.npm` cache 有权限问题，可以改用项目内 cache：

```bash
npm install --cache .npm-cache
```

### 2. 配置环境变量

复制环境变量模板：

```bash
cp .env.example .env
```

关键变量如下：

| Variable | Purpose |
|---|---|
| `DINGTALK_APP_KEY` | 钉钉应用 App Key |
| `DINGTALK_APP_SECRET` | 钉钉应用 App Secret |
| `DINGTALK_ROBOT_CODE` | 机器人消息发送标识 |
| `BOSS_USER_IDS` | 允许使用助理的老板 staffId，多个逗号分隔 |
| `REDIS_URL` | Redis 连接地址 |
| `BITABLE_APP_TOKEN` | 钉钉多维表应用 token |
| `BITABLE_TABLE_ID` | 钉钉多维表表 ID |
| `HERMES_BASE_URL` | LLM 网关地址 |
| `HERMES_MODEL` | LLM 模型名 |
| `HERMES_API_KEY` | LLM API Key |

### 3. 启动依赖并运行助理

仓库自带启动脚本，会尝试：

- 启动 Redis
- 启动本地 Hermes profile
- 自动修正 `.env` 里的 `HERMES_BASE_URL` / `HERMES_MODEL`
- 启动钉钉助理

```bash
./scripts/start.sh
```

如果你已经有独立的 Redis 和 LLM 网关，也可以直接运行：

```bash
npm start
```

## `.env.example` 说明

默认模板适合本地 Hermes 场景。如果你使用 `./scripts/start.sh`：

- `HERMES_BASE_URL` 会被修正为本地 Hermes 端口
- `HERMES_MODEL` 会被修正为首选 profile 名

如果你接的是远程模型服务，请手动把这两个变量改成对应值。

## 多维表建议字段

V1 推荐至少包含这些字段：

- `任务ID`
- `任务标题`
- `任务内容`
- `任务目的`
- `交付物`
- `负责人姓名`
- `负责人userId`
- `负责人部门`
- `老板姓名`
- `老板userId`
- `截止时间`
- `任务状态`
- `待办taskId`
- `待办完成时间`
- `是否逾期`
- `逾期天数`
- `创建时间`
- `确认时间`
- `派发时间`
- `最近一次状态更新时间`
- `老板原始想法`
- `AI整理摘要`

## 任务状态

当前状态流转是：

- `待确认 -> 进行中 -> 已完成`
- `进行中 -> 已逾期 -> 已完成`
- `待确认 / 进行中 -> 已取消`

## 定时任务

当前内置两个调度任务：

- 每 `15` 分钟执行一次逾期扫描
- 每天 `09:00` 给老板发送任务摘要

调度逻辑在 [src/jobs/scheduler.ts](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/jobs/scheduler.ts)。

## 测试

运行全部测试：

```bash
npm test -- --runInBand
```

运行单个测试文件：

```bash
npx jest tests/inspection.test.ts --runInBand
```

## 关键目录

- [src/index.ts](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/index.ts): 钉钉入口与消息分流
- [src/llm.ts](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/llm.ts): LLM 调用与结构化解析
- [src/executor.ts](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/executor.ts): 任务创建执行流
- [src/dingtalk/bitable.ts](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/dingtalk/bitable.ts): 多维表读写
- [src/inspection.ts](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/inspection.ts): 老板巡检查询
- [src/jobs/](/Users/wuche/Workspace/AI-team/dingtalk-ai-assistant/.worktrees/boss-task-closure-v1/src/jobs): 逾期修正与日报调度

