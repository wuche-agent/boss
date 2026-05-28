import cron from 'node-cron';
import { runOverdueSweep } from './overdueSweep';
import { buildDailyDigest } from './dailyDigest';
import { sendMessage } from '../dingtalk/message';

export function registerSchedulers(bossUserIds: string[]): void {
  cron.schedule('*/15 * * * *', () => {
    runOverdueSweep().catch(console.error);
  });

  cron.schedule('0 9 * * *', async () => {
    const digest = await buildDailyDigest();
    await Promise.all(bossUserIds.map(userId => sendMessage(userId, digest)));
  });
}
