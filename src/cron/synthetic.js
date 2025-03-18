import cron from 'node-cron';
import { syntheticMonitoring } from '../monitoring/synthetic';
import logger from '../services/logger';

// Run synthetic monitoring every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Starting synthetic monitoring checks...');
    const results = await syntheticMonitoring.runChecks();
    
    const failedChecks = results.filter(r => !r.success);
    if (failedChecks.length > 0) {
      logger.error('Synthetic monitoring checks failed:', failedChecks);
    } else {
      logger.info('All synthetic monitoring checks passed');
    }
  } catch (error) {
    logger.error('Error running synthetic monitoring:', error);
  }
}); 