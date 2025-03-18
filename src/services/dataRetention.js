import mongoose from 'mongoose';
import { Analytics } from '../models/analytics';
import logger from './logger';

class DataRetentionService {
  constructor() {
    this.retentionPolicies = {
      analytics: {
        default: 90,  // days
        detailed: 30, // days
        aggregated: 365 // days
      },
      experiments: {
        results: 180, // days
        raw: 30 // days
      },
      logs: {
        error: 90, // days
        info: 30, // days
        debug: 7 // days
      }
    };

    this.scheduleCleanup();
  }

  async cleanupAnalytics() {
    const now = new Date();

    try {
      // Clean up detailed analytics data
      await Analytics.deleteMany({
        timestamp: {
          $lt: new Date(now - this.retentionPolicies.analytics.detailed * 24 * 60 * 60 * 1000)
        },
        aggregated: { $ne: true }
      });

      // Clean up aggregated analytics data
      await Analytics.deleteMany({
        timestamp: {
          $lt: new Date(now - this.retentionPolicies.analytics.aggregated * 24 * 60 * 60 * 1000)
        },
        aggregated: true
      });

      logger.info('Analytics cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up analytics:', error);
    }
  }

  async cleanupExperiments() {
    const now = new Date();

    try {
      // Clean up raw experiment data
      await mongoose.model('ExperimentResult').deleteMany({
        timestamp: {
          $lt: new Date(now - this.retentionPolicies.experiments.raw * 24 * 60 * 60 * 1000)
        }
      });

      // Archive experiment results
      const oldExperiments = await mongoose.model('Experiment').find({
        endDate: {
          $lt: new Date(now - this.retentionPolicies.experiments.results * 24 * 60 * 60 * 1000)
        }
      });

      for (const experiment of oldExperiments) {
        await this.archiveExperiment(experiment);
      }

      logger.info('Experiments cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up experiments:', error);
    }
  }

  async archiveExperiment(experiment) {
    try {
      const results = await abTesting.getResults(experiment.name);
      
      await mongoose.model('ArchivedExperiment').create({
        name: experiment.name,
        startDate: experiment.startDate,
        endDate: experiment.endDate,
        results: results,
        archivedAt: new Date()
      });

      await experiment.remove();
    } catch (error) {
      logger.error(`Error archiving experiment ${experiment.name}:`, error);
    }
  }

  async cleanupLogs() {
    const now = new Date();

    try {
      await mongoose.model('Log').deleteMany({
        timestamp: {
          $lt: new Date(now - this.retentionPolicies.logs.debug * 24 * 60 * 60 * 1000)
        },
        level: 'debug'
      });

      await mongoose.model('Log').deleteMany({
        timestamp: {
          $lt: new Date(now - this.retentionPolicies.logs.info * 24 * 60 * 60 * 1000)
        },
        level: 'info'
      });

      await mongoose.model('Log').deleteMany({
        timestamp: {
          $lt: new Date(now - this.retentionPolicies.logs.error * 24 * 60 * 60 * 1000)
        },
        level: 'error'
      });

      logger.info('Logs cleanup completed');
    } catch (error) {
      logger.error('Error cleaning up logs:', error);
    }
  }

  scheduleCleanup() {
    const schedule = require('node-schedule');

    // Run cleanup daily at 2 AM
    schedule.scheduleJob('0 2 * * *', async () => {
      logger.info('Starting data retention cleanup...');
      
      await Promise.all([
        this.cleanupAnalytics(),
        this.cleanupExperiments(),
        this.cleanupLogs()
      ]);

      logger.info('Data retention cleanup completed');
    });
  }
}

export const dataRetention = new DataRetentionService(); 