# DingTalk AI Assistant

一个跑在 Mac mini 上的个人 AI 系统入口。钉钉负责收消息，服务负责分类、沉淀记忆、检索问答；需要交办任务时，再进入钉钉任务流程。

## 第一版能力

- 直接给机器人发内容：自动存入 AI 收件箱
- `/ask 问题`：基于最近记录回答
- `/recent 10`：查看最近 10 条记录
- `/today`：查看今日摘要
- `/task 让小王下周一前完成客户复盘`：进入任务交办流程
- `取消`：退出当前任务澄清或确认流程

## 本地启动

```bash
cp .env.example .env
npm install
npm start
```

如果你使用项目里的 Hermes + Redis 启动脚本：

```bash
./scripts/start.sh
```

## 必填配置

```bash
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_ROBOT_CODE=your_robot_code
BOSS_USER_IDS=userid1,userid2
HERMES_BASE_URL=http://localhost:11434/v1
HERMES_MODEL=hermes3
REDIS_URL=redis://localhost:6379
INBOX_TTL_DAYS=180
```

`BOSS_USER_IDS` 为空时所有人都能用；建议正式运行时只放自己的钉钉 staffId。

## 推荐部署方式

Mac mini 常驻运行：

```bash
cd /Users/wuche/Workspace/AI-team/dingtalk-ai-assistant
npm start
```

MacBook 作为工作台，用来改代码、审查日志、接入 Claude Code 或 Codex。高风险动作不要直接从钉钉消息触发，先让机器人回发确认。

## 验证

```bash
npm run typecheck
npm test
```

