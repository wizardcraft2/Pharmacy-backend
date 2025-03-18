import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable, Writable } from 'stream';
import mongoose from 'mongoose';
import logger from './logger';

class ArchivingService {
  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    this.bucketName = process.env.AWS_ARCHIVE_BUCKET;
  }

  async archiveData(collectionName, query = {}, options = {}) {
    const model = mongoose.model(collectionName);
    const timestamp = new Date().toISOString();
    const archiveKey = `${collectionName}/${timestamp}.json.gz`;

    try {
      logger.info(`Starting archive for ${collectionName}`);

      const cursor = model.find(query).cursor();
      const gzip = createGzip();

      const uploadStream = new Writable({
        write: async (chunk, encoding, callback) => {
          try {
            await this.s3.send(new PutObjectCommand({
              Bucket: this.bucketName,
              Key: archiveKey,
              Body: chunk,
              ContentType: 'application/gzip'
            }));
            callback();
          } catch (error) {
            callback(error);
          }
        }
      });

      let count = 0;
      const transformStream = new Writable({
        write: (doc, encoding, callback) => {
          count++;
          const data = JSON.stringify(doc) + '\n';
          callback(null, data);
        }
      });

      await pipeline(
        cursor,
        transformStream,
        gzip,
        uploadStream
      );

      const archiveRecord = await mongoose.model('Archive').create({
        collectionName,
        archiveKey,
        timestamp,
        recordCount: count,
        query: JSON.stringify(query),
        options: JSON.stringify(options)
      });

      if (options.deleteAfterArchive) {
        await model.deleteMany(query);
      }

      logger.info(`Archive completed for ${collectionName}: ${count} records`);
      return archiveRecord;

    } catch (error) {
      logger.error(`Error archiving ${collectionName}:`, error);
      throw error;
    }
  }

  async restoreData(archiveId) {
    const archive = await mongoose.model('Archive').findById(archiveId);
    if (!archive) {
      throw new Error('Archive not found');
    }

    const model = mongoose.model(archive.collectionName);
    let count = 0;

    try {
      logger.info(`Starting restoration from archive: ${archive.archiveKey}`);

      const { Body } = await this.s3.send(new GetObjectCommand({
        Bucket: this.bucketName,
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
                const doc = JSON.parse(line);
                documents.push(doc);
                count++;

                if (documents.length >= 1000) {
                  await model.insertMany(documents);
                  documents.length = 0;
                }
              }
            }
          }

          if (buffer && documents.length > 0) {
            await model.insertMany(documents);
          }
        }
      );

      archive.status = 'restored';
      archive.restoredAt = new Date();
      archive.restoredCount = count;
      await archive.save();

      logger.info(`Restoration completed: ${count} records restored`);
      return { success: true, count };

    } catch (error) {
      logger.error(`Error restoring from archive ${archive.archiveKey}:`, error);
      throw error;
    }
  }

  async listArchives(collectionName = null) {
    const query = collectionName ? { collectionName } : {};
    return mongoose.model('Archive').find(query).sort({ timestamp: -1 });
  }

  async deleteArchive(archiveId) {
    const archive = await mongoose.model('Archive').findById(archiveId);
    if (!archive) {
      throw new Error('Archive not found');
    }

    try {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: archive.archiveKey
      }));

      await archive.remove();
      logger.info(`Archive deleted: ${archive.archiveKey}`);
      return { success: true };

    } catch (error) {
      logger.error(`Error deleting archive ${archive.archiveKey}:`, error);
      throw error;
    }
  }
}

export const archiving = new ArchivingService(); 