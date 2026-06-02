import * as dotenv from 'dotenv';
dotenv.config();

import { DWClient, DWClientDownStream, EventAck, TOPIC_ROBOT } from 'dingtalk-stream';
import { isAuthorizedMessage, extractMessageText } from './router';
import { getSession, setSession, clearSession, Session } from './conversation';
import { answerInboxQuestion, conductConversation, initLLM } from './llm';
import { executeTask } from './executor';
import { handleTodoComplete } from './events/todoComplete';
import { sendMessage } from './dingtalk/message';
import { downloadDingTalkMessageFile, extractDingTalkFileInfo } from './dingtalk/file';
import { parseCommand } from './commands';
import {
  buildHelpText,
  captureInboxItem,
  formatInboxList,
  formatInboxSavedReply,
  getRecentInboxItems,
  getTodayInboxItems,
} from './inbox';
import {
  formatRecentFiles,
  formatSearchResults,
  recordAssistantReply,
  recordIncomingMessage,
  registerFileMetadata,
  runKnowledgeSearch,
  saveManualKnowledge,
} from './aios/core';

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
  msgId?: string;
  msgtype?: string;
  conversationId?: string;
  senderId?: string;
  senderStaffId?: string;
  senderNick?: string;
  conversationType?: string;
  isInAtList?: boolean;
  text?: { content: string };
}

async function replyToUser(userId: string, content: string): Promise<void> {
  await sendMessage(userId, content);
  recordAssistantReply(userId, content);
}

async function handleRobotMessage(msg: DWClientDownStream): Promise<void> {
  const event = JSON.parse(msg.data) as RobotMessageEvent;
  const userId = event.senderStaffId ?? event.senderId ?? '';
  console.log(`[robot] staffId=${event.senderStaffId} nick=${event.senderNick} text=${event.text?.content}`);

  if (!isAuthorizedMessage(event) || !userId) return;

  const text = extractMessageText(event);
  const incoming = recordIncomingMessage({
    channel: 'dingtalk',
    userId,
    senderNick: event.senderNick,
    messageType: event.msgtype ?? (event.text ? 'text' : 'unknown'),
    content: text,
    externalMessageId: event.msgId ?? msg.headers.messageId,
    conversationId: event.conversationId,
    raw: event,
  });
  const command = parseCommand(text);
  const existingSession = await getSession(userId);
  const fileInfo = extractDingTalkFileInfo(event);

  if (command.type === 'help') {
    await replyToUser(userId, buildHelpText());
    return;
  }

  if (command.type === 'cancel') {
    await clearSession(userId);
    await replyToUser(userId, '好的，当前流程已取消。新内容我会继续收入 AI 收件箱。');
    return;
  }

  if (existingSession) {
    await handleTaskConversation(userId, event, text, existingSession);
    return;
  }

  if (fileInfo) {
    const pending = registerFileMetadata({
      sourceMessageId: incoming.id,
      channel: 'dingtalk',
      originalName: fileInfo.fileName,
      mimeType: fileInfo.mimeType,
      size: fileInfo.size,
      remoteId: fileInfo.mediaId ?? fileInfo.downloadCode,
      raw: fileInfo.raw,
    });

    try {
      await downloadDingTalkMessageFile(fileInfo, pending.localPath);
      const saved = registerFileMetadata({
        id: pending.id,
        sourceMessageId: incoming.id,
        channel: 'dingtalk',
        originalName: fileInfo.fileName,
        mimeType: fileInfo.mimeType,
        size: fileInfo.size,
        remoteId: fileInfo.mediaId ?? fileInfo.downloadCode,
        raw: fileInfo.raw,
        downloadStatus: 'saved',
      });
      saveManualKnowledge({
        sourceMessageId: incoming.id,
        content: `文件：${saved.originalName}\n路径：${saved.localPath}`,
        title: saved.originalName,
        sourceType: 'file',
      });
      await replyToUser(userId, `文件已保存到 Mac mini：\n${saved.localPath}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      registerFileMetadata({
        id: pending.id,
        sourceMessageId: incoming.id,
        channel: 'dingtalk',
        originalName: fileInfo.fileName,
        mimeType: fileInfo.mimeType,
        size: fileInfo.size,
        remoteId: fileInfo.mediaId ?? fileInfo.downloadCode,
        raw: fileInfo.raw,
        downloadStatus: 'failed',
        downloadError: message,
      });
      await replyToUser(userId, `我识别到了文件，但下载失败：${message}`);
    }
    return;
  }

  if (command.type === 'recent') {
    const items = await getRecentInboxItems(userId, command.limit);
    await replyToUser(userId, formatInboxList(items));
    return;
  }

  if (command.type === 'today') {
    const items = await getTodayInboxItems(userId);
    await replyToUser(userId, formatInboxList(items, '今日摘要'));
    return;
  }

  if (command.type === 'ask') {
    const items = await getRecentInboxItems(userId, 30);
    const answer = await answerInboxQuestion(command.question, items);
    await replyToUser(userId, answer);
    return;
  }

  if (command.type === 'search') {
    if (!command.query) {
      await replyToUser(userId, '要搜索什么？例如：/search 客户复盘');
      return;
    }
    const results = runKnowledgeSearch(command.query, 8);
    await replyToUser(userId, formatSearchResults(results, command.query));
    return;
  }

  if (command.type === 'save') {
    if (!command.text) {
      await replyToUser(userId, '要保存什么？例如：/save 这是一条重要信息');
      return;
    }
    const item = await captureInboxItem(userId, command.text, {
      senderNick: event.senderNick,
      sourceMessageId: incoming.id,
      sourceType: 'manual',
    });
    await replyToUser(userId, formatInboxSavedReply(item));
    return;
  }

  if (command.type === 'todo') {
    if (!command.text) {
      await replyToUser(userId, '要记录什么待办？例如：/todo 明天下午提醒我联系张三');
      return;
    }
    const item = await captureInboxItem(userId, command.text, {
      senderNick: event.senderNick,
      sourceMessageId: incoming.id,
      sourceType: 'todo',
    });
    await replyToUser(userId, `待办已保存到 Mac mini：\n${formatInboxSavedReply(item)}`);
    return;
  }

  if (command.type === 'file') {
    await replyToUser(userId, formatRecentFiles(8));
    return;
  }

  if (command.type === 'code') {
    if (!command.text) {
      await replyToUser(userId, '要保存什么代码任务？例如：/code 修一下项目里的报错');
      return;
    }
    const item = saveManualKnowledge({
      sourceMessageId: incoming.id,
      content: command.text,
      title: command.text.slice(0, 40) || '代码任务',
      sourceType: 'code',
    });
    await replyToUser(userId, `代码任务已保存，后续可接 Claude Code / Codex 执行。\n编号：${item.id}`);
    return;
  }

  if (command.type === 'task') {
    const session: Session = { step: 'clarifying', history: [] };
    if (!command.text) {
      const reply = '要交办什么事？请告诉我目标、负责人和截止时间，我会帮你整理成任务。';
      await setSession(userId, { ...session, history: [{ role: 'assistant', content: reply }] });
      await replyToUser(userId, reply);
      return;
    }
    await handleTaskConversation(userId, event, command.text, session);
    return;
  }

  const item = await captureInboxItem(userId, command.text, {
    senderNick: event.senderNick,
    sourceMessageId: incoming.id,
  });
  await replyToUser(userId, formatInboxSavedReply(item));
}

async function handleTaskConversation(
  userId: string,
  event: RobotMessageEvent,
  text: string,
  session: Session
): Promise<void> {
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
          notes: task.notes,
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
          await replyToUser(userId, notFoundMsg);
        } else {
          await replyToUser(userId, '❌ 任务创建失败，请稍后重试。回复"确认"可再次尝试。');
        }
      }
      return;
    }

    if (lower.includes('取消') || lower.includes('算了') || lower.includes('不了')) {
      await clearSession(userId);
      await replyToUser(userId, '好的，任务已取消。有新想法随时找我。');
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
  await replyToUser(userId, reply);
}

initLLM()
  .then(() => client
    .connect()
    .then(() => console.log('DingTalk Stream client started successfully'))
    .catch((err: Error) => {
      console.error('Failed to start DingTalk Stream client:', err);
      process.exit(1);
    })
  )
  .catch((err: Error) => {
    console.error(err.message);
    process.exit(1);
  });
