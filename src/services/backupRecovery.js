import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { backupVerification } from './backupVerification';
import logger from './logger';

class BackupRecoveryService {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  async startRecovery(archiveId, options = {}) {
    const archive = await mongoose.model('Archive').findById(archiveId);
    if (!archive) {
      throw new Error('Archive not found');
    }

    try {
      // Create recovery record
      const recovery = await mongoose.model('Recovery').create({
        archiveId: archive._id,
        status: 'in_progress',
        options,
        startTime: new Date()
      });

      // Verify archive before recovery
      if (options.verifyFirst) {
        const verification = await backupVerification.verifyArchive(archiveId);
        if (!verification.checks.every(check => check.passed)) {
          throw new Error('Archive verification failed');
        }
      }

      // Start recovery process
      const result = await this.recoverData(archive, recovery, options);
      
      // Update recovery record
      recovery.status = 'completed';
      recovery.endTime = new Date();
      recovery.result = result;
      await recovery.save();

      return recovery;

    } catch (error) {
      logger.error(`Error recovering archive ${archive.archiveKey}:`, error);
      
      // Update recovery record with error
      await mongoose.model('Recovery').findByIdAndUpdate(recovery._id, {
        status: 'failed',
        endTime: new Date(),
        error: error.message
      });

      throw error;
    }
  }

  async recoverData(archive, recovery, options) {
    const model = mongoose.model(archive.collectionName);
    let count = 0;
    let errors = [];

    try {
      const { Body } = await this.s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_ARCHIVE_BUCKET,
        Key: archive.archiveKey
      }));

      const gunzip = createGunzip();
      const documents = [];

      await pipeline(
        Body,
        gunzip,
        async function* (source) {
          let buffer = '';
          
          for await (const chunk of source) {
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              if (line) {
                try {
                  const doc = JSON.parse(line);
                  
                  if (options.transformData) {
                    const transformed = await options.transformData(doc);
                    if (transformed) {
                      documents.push(transformed);
                    }
                  } else {
                    documents.push(doc);
                  }

                  count++;

                  if (documents.length >= 1000) {
                    if (options.dryRun) {
                      documents.length = 0;
                      continue;
                    }

                    await model.insertMany(documents, {
                      ordered: false,
                      ...(options.insertOptions || {})
                    });
                    documents.length = 0;
                  }
                } catch (error) {
                  errors.push({
                    line: count,
                    error: error.message
                  });
                }
              }
            }

            // Update recovery progress
            await recovery.updateOne({
              $set: {
                progress: {
                  processed: count,
                  errors: errors.length
                }
              }
            });
          }

          // Insert remaining documents
          if (documents.length > 0 && !options.dryRun) {
            await model.insertMany(documents, {
              ordered: false,
              ...(options.insertOptions || {})
            });
          }
        }
      );

      return {
        processed: count,
        errors,
        dryRun: options.dryRun || false
      };

    } catch (error) {
      logger.error('Error in recovery process:', error);
      throw error;
    }
  }

  async getRecoveryStatus(recoveryId) {
    return mongoose.model('Recovery').findById(recoveryId);
  }

  async listRecoveries(archiveId) {
    return mongoose.model('Recovery')
      .find({ archiveId })
      .sort({ startTime: -1 });
  }

  async cancelRecovery(recoveryId) {
    const recovery = await mongoose.model('Recovery').findById(recoveryId);
    if (!recovery || recovery.status !== 'in_progress') {
      throw new Error('Cannot cancel recovery');
    }

    recovery.status = 'cancelled';
    recovery.endTime = new Date();
    await recovery.save();

    return recovery;
  }
}

export const backupRecovery = new BackupRecoveryService(); 