import { parseCommand } from '../src/commands';

describe('commands', () => {
  it('parses help commands', () => {
    expect(parseCommand('帮助')).toEqual({ type: 'help' });
    expect(parseCommand('/help')).toEqual({ type: 'help' });
  });

  it('parses recent commands with bounded limit', () => {
    expect(parseCommand('/recent 10')).toEqual({ type: 'recent', limit: 10 });
    expect(parseCommand('最近 100')).toEqual({ type: 'recent', limit: 20 });
  });

  it('parses ask commands', () => {
    expect(parseCommand('/ask 今天有哪些重要事项')).toEqual({
      type: 'ask',
      question: '今天有哪些重要事项',
    });
  });

  it('parses task commands', () => {
    expect(parseCommand('/task 让小王明天交报告')).toEqual({
      type: 'task',
      text: '让小王明天交报告',
    });
    expect(parseCommand('交办小王明天交报告')).toEqual({
      type: 'task',
      text: '小王明天交报告',
    });
  });

  it('treats ordinary text as inbox capture', () => {
    expect(parseCommand('这个客户下周要重点跟进')).toEqual({
      type: 'capture',
      text: '这个客户下周要重点跟进',
    });
  });
});

