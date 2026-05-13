import { isAuthorizedMessage, extractMessageText } from '../src/router';

describe('router', () => {
  beforeEach(() => {
    process.env.BOSS_USER_IDS = 'boss_001,boss_002';
  });

  it('allows whitelisted sender in single chat', () => {
    const event = { senderId: 'boss_001', conversationType: '1', isInAtList: false };
    expect(isAuthorizedMessage(event)).toBe(true);
  });

  it('rejects non-whitelisted sender', () => {
    const event = { senderId: 'random_user', conversationType: '1', isInAtList: false };
    expect(isAuthorizedMessage(event)).toBe(false);
  });

  it('allows whitelisted sender in group when @mentioned', () => {
    const event = { senderId: 'boss_002', conversationType: '2', isInAtList: true };
    expect(isAuthorizedMessage(event)).toBe(true);
  });

  it('rejects group message when not @mentioned', () => {
    const event = { senderId: 'boss_001', conversationType: '2', isInAtList: false };
    expect(isAuthorizedMessage(event)).toBe(false);
  });

  it('extracts text from message event', () => {
    const event = { text: { content: '  让小王做个报告  ' } };
    expect(extractMessageText(event)).toBe('让小王做个报告');
  });
});
