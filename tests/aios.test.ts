import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  createKnowledgeFromClassification,
  formatRecentFiles,
  formatSearchResults,
  recordIncomingMessage,
  registerFileMetadata,
  runKnowledgeSearch,
  saveManualKnowledge,
} from '../src/aios/core';
import { _resetDbForTesting } from '../src/aios/store';

describe('AI OS core', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'aios-test-'));
    process.env.AIOS_ROOT = root;
    _resetDbForTesting();
  });

  afterEach(() => {
    _resetDbForTesting();
    delete process.env.AIOS_ROOT;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('records incoming messages and searchable knowledge', () => {
    const message = recordIncomingMessage({
      channel: 'dingtalk',
      userId: 'user_1',
      senderNick: '武彻',
      messageType: 'text',
      content: '客户复盘要沉淀到知识库',
      externalMessageId: 'msg_1',
      raw: { hello: 'world' },
    });

    createKnowledgeFromClassification({
      sourceMessageId: message.id,
      content: '客户复盘要沉淀到知识库',
      classification: {
        kind: 'note',
        title: '客户复盘',
        summary: '客户复盘要进入知识库',
        tags: ['客户'],
        importance: 'normal',
      },
    });

    const results = runKnowledgeSearch('客户复盘');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('客户复盘');
    expect(formatSearchResults(results, '客户复盘')).toContain('客户复盘');
  });

  it('saves manual todos and file metadata', () => {
    const todo = saveManualKnowledge({
      content: '明天下午提醒我联系张三',
      sourceType: 'todo',
    });
    expect(todo.sourceType).toBe('todo');

    const file = registerFileMetadata({
      channel: 'dingtalk',
      originalName: '客户 复盘.pdf',
      size: 2048,
      remoteId: 'media_1',
    });

    expect(file.localPath).toContain('客户 复盘.pdf');
    expect(formatRecentFiles()).toContain('客户 复盘.pdf');
  });
});

