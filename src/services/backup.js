import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { S3 } from 'aws-sdk';
import logger from './logger';

const execAsync = promisify(exec);
const BACKUP_DIR = path.join(process.cwd(), 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

export const backupService = {
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup-${timestamp}.gz`;
      const filepath = path.join(BACKUP_DIR, filename);

      // Create MongoDB dump
      await execAsync(`mongodump --uri="${process.env.MONGODB_URI}" --archive="${filepath}" --gzip`);

      // Upload to S3
      if (process.env.AWS_BUCKET_NAME) {
        await s3.upload({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `mongodb-backups/${filename}`,
          Body: fs.createReadStream(filepath)
        }).promise();

        // Delete local file after upload
        fs.unlinkSync(filepath);
        
        logger.info(`Backup uploaded to S3: ${filename}`);
      }

      return filename;
    } catch (error) {
      logger.error('Backup failed:', error);
      throw error;
    }
  },

  async restoreBackup(filename) {
    try {
      let filepath = path.join(BACKUP_DIR, filename);

      // Download from S3 if not found locally
      if (!fs.existsSync(filepath) && process.env.AWS_BUCKET_NAME) {
        const response = await s3.getObject({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: `mongodb-backups/${filename}`
        }).promise();

        fs.writeFileSync(filepath, response.Body);
      }

      // Restore from backup
      await execAsync(`mongorestore --uri="${process.env.MONGODB_URI}" --archive="${filepath}" --gzip`);
      
      logger.info(`Restore completed from: ${filename}`);
    } catch (error) {
      logger.error('Restore failed:', error);
      throw error;
    }
  }
}; 