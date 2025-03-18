import cron from 'node-cron';
import { backupService } from '../services/backup';
import logger from '../services/logger';

// Schedule daily backup at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Starting scheduled backup...');
    await backupService.createBackup();
    logger.info('Scheduled backup completed successfully');
  } catch (error) {
    logger.error('Scheduled backup failed:', error);
  }
}); 