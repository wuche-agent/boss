import * as dotenv from 'dotenv';
dotenv.config();

import { DWClient, DWClientDownStream, EventAck, TOPIC_ROBOT } from 'dingtalk-stream';
import { isAuthorizedMessage, extractMessageText } from './router';
import { getSession, setSession, clearSession, Session } from './conversation';
import { conductConversation } from './llm';
import { executeTask } from './executor';
import { handleTodoComplete } from './events/todoComplete';
import { sendMessage } from './dingtalk/message';

const TOPIC_TODO_FINISH = 'todo.task.finish';

const client = new DWClient({
  clientId: process.env.DINGTALK_APP_KEY ?? '',
  clientSecret: process.env.DINGTALK_APP_SECRET ?? '',
});

client.registerCallbackListener(TOPIC_ROBOT, (msg: DWClientDownStream) => {
  client.socketCallBackResponse(msg.headers.messageId, { status: EventAck.SUCCESS });
  handleRobotMessage(msg).catch(console.error);
});

client.registerAllEventListener((msg: DWClientDownStream) => {
  if (msg.headers.topic === TOPIC_TODO_FINISH) {
    const event = JSON.parse(msg.data) as Record<string, unknown>;
    handleTodoComplete(event).catch(console.error);
  }
  return { status: EventAck.SUCCESS };
});

interface RobotMessageEvent {
  senderId?: string;
  senderStaffId?: string;
  senderNick?: string;
  conversationType?: string;
  isInAtList?: boolean;
  text?: { content: string };
}

async function handleRobotMessage(msg: DWClientDownStream): Promise<void> {
  const event = JSON.parse(msg.data) as RobotMessageEvent;
  const userId = event.senderStaffId ?? event.senderId ?? '';
  console.log(`[robot] staffId=${event.senderStaffId} nick=${event.senderNick} text=${event.text?.content}`);

  if (!isAuthorizedMessage(event) || !userId) return;

  const text = extractMessageText(event);
  const session: Session = (await getSession(userId)) ?? { step: 'clarifying', history: [] };

  // Awaiting confirmation of a finalized task
  if (session.step === 'awaiting_confirm' && session.pending_task) {
    const lower = text.toLowerCase();
    if (lower.includes('确认') || lower === 'ok') {
      const task = session.pending_task;
      try {
        await executeTask({
          bossUserId: userId,
          bossName: event.senderNick ?? '老板',
          assigneeName: task.assignee_name,
          goal: task.goal,
          detail: task.detail,
          deadline: task.deadline,
          summary: task.summary,
        });
        await clearSession(userId);
      } catch (err) {
        console.error('executeTask failed:', err);
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('未找到用户')) {
          // User not found — ask boss for the real name and re-enter clarifying
          const notFoundMsg = `❌ ${msg}\n请告诉我TA在钉钉通讯录里的真实姓名，我来更新任务。`;
          const updatedHistory = [
            ...session.history,
            { role: 'assistant' as const, content: notFoundMsg },
          ];
          await setSession(userId, { step: 'clarifying', history: updatedHistory });
          await sendMessage(userId, notFoundMsg);
        } else {
          await sendMessage(userId, '❌ 任务创建失败，请稍后重试。回复"确认"可再次尝试。');
        }
      }
      return;
    }

    if (lower.includes('取消') || lower.includes('算了') || lower.includes('不了')) {
      await clearSession(userId);
      await sendMessage(userId, '好的，任务已取消。有新想法随时找我。');
      return;
    }

    // Boss wants to adjust — continue conversation
  }

  // Drive conversation with LLM
  const updatedHistory = [...session.history, { role: 'user' as const, content: text }];
  console.log(`[llm] calling conductConversation, history length=${updatedHistory.length}`);
  const { reply, task } = await conductConversation(updatedHistory);
  console.log(`[llm] reply=${reply.slice(0, 80)} task=${task ? JSON.stringify(task) : 'none'}`);

  const newSession: Session = {
    step: task ? 'awaiting_confirm' : 'clarifying',
    history: [...updatedHistory, { role: 'assistant' as const, content: reply }],
    pending_task: task ?? session.pending_task,
  };

  await setSession(userId, newSession);
  await sendMessage(userId, reply);
}

client
  .connect()
  .then(() => console.log('DingTalk Stream client started successfully'))
  .catch((err: Error) => {
    console.error('Failed to start DingTalk Stream client:', err);
    process.exit(1);
  });
