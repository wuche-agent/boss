export type ParsedCommand =
  | { type: 'help' }
  | { type: 'recent'; limit: number }
  | { type: 'today' }
  | { type: 'ask'; question: string }
  | { type: 'search'; query: string }
  | { type: 'save'; text: string }
  | { type: 'todo'; text: string }
  | { type: 'file'; text: string }
  | { type: 'code'; text: string }
  | { type: 'task'; text: string }
  | { type: 'cancel' }
  | { type: 'capture'; text: string };

const DEFAULT_RECENT_LIMIT = 8;
const MAX_RECENT_LIMIT = 20;

function parseLimit(rest: string): number {
  const match = rest.match(/\d+/);
  if (!match) return DEFAULT_RECENT_LIMIT;
  return Math.min(Math.max(Number(match[0]), 1), MAX_RECENT_LIMIT);
}

function stripPrefix(text: string, prefixes: string[]): string | null {
  const normalized = text.trim();
  for (const prefix of prefixes) {
    if (normalized === prefix) return '';
    if (normalized.startsWith(`${prefix} `)) return normalized.slice(prefix.length).trim();
    if (/[\u4e00-\u9fa5]$/.test(prefix) && normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }
  return null;
}

export function parseCommand(text: string): ParsedCommand {
  const normalized = text.trim();
  if (!normalized) return { type: 'help' };

  if (['/help', 'help', '帮助', '菜单', '?', '？'].includes(normalized.toLowerCase())) {
    return { type: 'help' };
  }

  if (['/cancel', 'cancel', '取消', '算了', '不了'].includes(normalized.toLowerCase())) {
    return { type: 'cancel' };
  }

  const recentRest = stripPrefix(normalized, ['/recent', 'recent', '最近', '最近记录']);
  if (recentRest !== null) return { type: 'recent', limit: parseLimit(recentRest) };

  if (['/today', 'today', '今日总结', '今天总结', '今日', '今天'].includes(normalized.toLowerCase())) {
    return { type: 'today' };
  }

  const askRest = stripPrefix(normalized, ['/ask', 'ask', '问', '查询', '检索']);
  if (askRest !== null && askRest) return { type: 'ask', question: askRest };

  const searchRest = stripPrefix(normalized, ['/search', 'search', '搜索', '查找']);
  if (searchRest !== null) return { type: 'search', query: searchRest };

  const saveRest = stripPrefix(normalized, ['/save', 'save', '保存', '记录']);
  if (saveRest !== null) return { type: 'save', text: saveRest };

  const todoRest = stripPrefix(normalized, ['/todo', 'todo', '待办', '提醒']);
  if (todoRest !== null) return { type: 'todo', text: todoRest };

  const fileRest = stripPrefix(normalized, ['/file', 'file', '文件']);
  if (fileRest !== null) return { type: 'file', text: fileRest };

  const codeRest = stripPrefix(normalized, ['/code', 'code', '代码']);
  if (codeRest !== null) return { type: 'code', text: codeRest };

  const taskRest = stripPrefix(normalized, ['/task', '/delegate', 'task', 'delegate', '交办', '派活', '安排']);
  if (taskRest !== null) return { type: 'task', text: taskRest };

  return { type: 'capture', text: normalized };
}
