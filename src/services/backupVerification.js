import { createHash } from 'crypto';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import mongoose from 'mongoose';
import logger from './logger';

class BackupVerificationService {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1'
    });
  }

  async verifyArchive(archiveId) {
    const archive = await mongoose.model('Archive').findById(archiveId);
    if (!archive) {
      throw new Error('Archive not found');
    }

    try {
      logger.info(`Starting verification for archive: ${archive.archiveKey}`);

      const verification = {
        archiveId: archive._id,
        startTime: new Date(),
        status: 'in_progress',
        checks: []
      };

      // Verify S3 object exists and is accessible
      const s3Check = await this.verifyS3Object(archive.archiveKey);
      verification.checks.push(s3Check);

      // Verify file integrity
      const integrityCheck = await this.verifyFileIntegrity(archive);
      verification.checks.push(integrityCheck);

      // Verify record count
      const countCheck = await this.verifyRecordCount(archive);
      verification.checks.push(countCheck);

      // Update verification status
      verification.endTime = new Date();
      verification.status = verification.checks.every(c => c.passed) 
        ? 'passed' 
        : 'failed';

      // Save verification results
      await mongoose.model('ArchiveVerification').create(verification);

      return verification;

    } catch (error) {
      logger.error(`Error verifying archive ${archive.archiveKey}:`, error);
      throw error;
    }
  }

  async verifyS3Object(key) {
    try {
      await this.s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_ARCHIVE_BUCKET,
        Key: key
      }));

      return {
        type: 's3_check',
        passed: true,
        message: 'Archive file is accessible in S3'
      };
    } catch (error) {
      return {
        type: 's3_check',
        passed: false,
        message: 'Archive file is not accessible in S3',
        error: error.message
      };
    }
  }

  async verifyFileIntegrity(archive) {
    try {
      const { Body } = await this.s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_ARCHIVE_BUCKET,
        Key: archive.archiveKey
      }));

      const hash = createHash('sha256');
      for await (const chunk of Body) {
        hash.update(chunk);
      }

      const calculatedHash = hash.digest('hex');
      const storedHash = archive.contentHash;

      return {
        type: 'integrity_check',
        passed: calculatedHash === storedHash,
        message: calculatedHash === storedHash
          ? 'Archive file integrity verified'
          : 'Archive file integrity check failed',
        details: {
          calculated: calculatedHash,
          stored: storedHash
        }
      };
    } catch (error) {
      return {
        type: 'integrity_check',
        passed: false,
        message: 'Error checking file integrity',
        error: error.message
      };
    }
  }

  async verifyRecordCount(archive) {
    try {
      const { Body } = await this.s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_ARCHIVE_BUCKET,
        Key: archive.archiveKey
      }));

      let count = 0;
      for await (const chunk of Body) {
        count += chunk.toString().split('\n').filter(line => line.trim()).length;
      }

      return {
        type: 'count_check',
        passed: count === archive.recordCount,
        message: count === archive.recordCount
          ? 'Record count matches'
          : 'Record count mismatch',
        details: {
          counted: count,
          expected: archive.recordCount
        }
      };
    } catch (error) {
      return {
        type: 'count_check',
        passed: false,
        message: 'Error verifying record count',
        error: error.message
      };
    }
  }

  async getVerificationHistory(archiveId) {
    return mongoose.model('ArchiveVerification')
      .find({ archiveId })
      .sort({ startTime: -1 });
  }
}

export const backupVerification = new BackupVerificationService(); 