import * as dotenv from 'dotenv';
dotenv.config();

import { DWClient, DWClientDownStream, EventAck, EventAckData, TOPIC_ROBOT } from 'dingtalk-stream';
import { isAuthorizedMessage, extractMessageText } from './router';
import { getSession, setSession, clearSession, Session } from './conversation';
import { generateTaskSummary } from './llm';
import { executeTask } from './executor';
import { handleTodoComplete } from './events/todoComplete';
import { sendMessage } from './dingtalk/message';

const TOPIC_TODO_FINISH = 'todo.task.finish';

const client = new DWClient({
  clientId: process.env.DINGTALK_APP_KEY ?? '',
  clientSecret: process.env.DINGTALK_APP_SECRET ?? '',
});

client.registerAllEventListener((msg: DWClientDownStream): EventAckData => {
  const topic = msg.headers.topic;

  if (topic === TOPIC_ROBOT) {
    handleRobotMessage(msg).catch(console.error);
  } else if (topic === TOPIC_TODO_FINISH) {
    const event = JSON.parse(msg.data) as Record<string, unknown>;
    handleTodoComplete(event).catch(console.error);
  }

  return { status: EventAck.SUCCESS };
});

async function handleRobotMessage(msg: DWClientDownStream): Promise<void> {
  const event = JSON.parse(msg.data) as {
    senderId?: string;
    senderNick?: string;
    conversationType?: string;
    isInAtList?: boolean;
    text?: { content: string };
  };

  if (!isAuthorizedMessage(event)) return;

  const userId = event.senderId ?? '';
  if (!userId) return;

  const text = extractMessageText(event);
  const session = await getSession(userId);

  if (!session) {
    // No session — start new conversation flow
    await setSession(userId, {
      step: 'awaiting_assignee',
      raw_intent: text,
    });
    await sendMessage(
      userId,
      '收到！请问这个任务由谁负责？（请告诉我对方的姓名或钉钉账号）'
    );
    return;
  }

  if (session.step === 'awaiting_assignee') {
    const updated: Session = {
      ...session,
      assignee_name: text,
      assignee_user_id: text,
      step: 'awaiting_deadline',
    };
    await setSession(userId, updated);
    await sendMessage(
      userId,
      `好的，负责人是${text}。截止日期是？（格式：YYYY-MM-DD）\n注意：如果输入的是姓名而非钉钉 userId，请确认对方的钉钉 userId 以便系统正确指派。`
    );
    return;
  }

  if (session.step === 'awaiting_deadline') {
    const updated: Session = {
      ...session,
      deadline: text,
      step: 'awaiting_detail',
    };
    await setSession(userId, updated);
    await sendMessage(userId, `截止 ${text}，具体要做什么？`);
    return;
  }

  if (session.step === 'awaiting_detail') {
    const updated: Session = {
      ...session,
      detail: text,
      step: 'awaiting_confirm',
    };
    await setSession(userId, updated);
    const summary = await generateTaskSummary(updated);
    await sendMessage(
      userId,
      `请确认以下任务信息：\n${summary}\n\n回复"确认"或"ok"完成创建，或重新描述任务。`
    );
    return;
  }

  if (session.step === 'awaiting_confirm') {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('确认') || lowerText === 'ok') {
      const summary = await generateTaskSummary(session);
      const senderNick = event.senderNick ?? '老板';
      try {
        await executeTask({
          bossUserId: userId,
          bossName: senderNick,
          assigneeUserId: session.assignee_user_id ?? '',
          assigneeName: session.assignee_name ?? '',
          detail: session.detail ?? '',
          deadline: session.deadline ?? '',
          summary,
        });
        await clearSession(userId);
      } catch (err) {
        console.error('executeTask failed:', err);
        await sendMessage(userId, '❌ 任务创建失败，请稍后重试。回复"确认"可再次尝试。');
      }
    } else {
      // Restart from awaiting_assignee
      await setSession(userId, {
        step: 'awaiting_assignee',
        raw_intent: text,
      });
      await sendMessage(
        userId,
        '好的，让我们重新开始。请问这个任务由谁负责？（请告诉我对方的姓名或钉钉账号）'
      );
    }
    return;
  }
}

client
  .connect()
  .then(() => {
    console.log('DingTalk Stream client started successfully');
  })
  .catch((err: Error) => {
    console.error('Failed to start DingTalk Stream client:', err);
    process.exit(1);
  });
