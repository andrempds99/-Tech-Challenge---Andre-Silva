import cron from 'node-cron';
import { createArticle } from './articleService.js';

const defaultSchedule = process.env.CRON_SCHEDULE || '0 3 * * *';

export function startArticleJob() {
  console.log(`Starting article cron at "${defaultSchedule}"`);
  cron.schedule(defaultSchedule, async () => {
    try {
      await createArticle();
      console.log('Daily article generated');
    } catch (err) {
      console.error('Daily article generation failed', err.message);
    }
  });
}


