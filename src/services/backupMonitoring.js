import mongoose from 'mongoose';
import { backupVerification } from './backupVerification';
import { metrics } from '../middleware/metrics';
import logger from './logger';

class BackupMonitoringService {
  constructor() {
    this.metrics = {
      backupSize: new metrics.Gauge({
        name: 'backup_size_bytes',
        help: 'Size of backup archives in bytes'
      }),
      backupDuration: new metrics.Histogram({
        name: 'backup_duration_seconds',
        help: 'Duration of backup operations'
      }),
      backupSuccess: new metrics.Counter({
        name: 'backup_success_total',
        help: 'Total number of successful backups'
      }),
      backupFailure: new metrics.Counter({
        name: 'backup_failure_total',
        help: 'Total number of failed backups'
      }),
      verificationStatus: new metrics.Gauge({
        name: 'backup_verification_status',
        help: 'Status of backup verifications',
        labelNames: ['archive']
      })
    };
  }

  async getBackupStats(timeRange = '24h') {
    const now = new Date();
    const startDate = new Date(now - this.parseTimeRange(timeRange));

    const archives = await mongoose.model('Archive')
      .find({
        timestamp: { $gte: startDate }
      })
      .sort({ timestamp: -1 });

    const verifications = await mongoose.model('ArchiveVerification')
      .find({
        startTime: { $gte: startDate }
      })
      .sort({ startTime: -1 });

    const recoveries = await mongoose.model('Recovery')
      .find({
        startTime: { $gte: startDate }
      })
      .sort({ startTime: -1 });

    return {
      summary: {
        totalArchives: archives.length,
        totalSize: archives.reduce((sum, a) => sum + a.size, 0),
        successRate: this.calculateSuccessRate(verifications),
        lastBackup: archives[0]?.timestamp
      },
      archives: this.groupArchivesByCollection(archives),
      verifications: this.summarizeVerifications(verifications),
      recoveries: this.summarizeRecoveries(recoveries)
    };
  }

  parseTimeRange(range) {
    const units = {
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };
    const match = range.match(/^(\d+)([hdw])$/);
    if (!match) throw new Error('Invalid time range format');
    return match[1] * units[match[2]];
  }

  calculateSuccessRate(verifications) {
    if (verifications.length === 0) return 0;
    const successful = verifications.filter(v => v.status === 'passed').length;
    return (successful / verifications.length) * 100;
  }

  groupArchivesByCollection(archives) {
    const groups = new Map();
    
    for (const archive of archives) {
      if (!groups.has(archive.collectionName)) {
        groups.set(archive.collectionName, {
          count: 0,
          totalSize: 0,
          latest: null
        });
      }

      const group = groups.get(archive.collectionName);
      group.count++;
      group.totalSize += archive.size;
      if (!group.latest || archive.timestamp > group.latest) {
        group.latest = archive.timestamp;
      }
    }

    return Object.fromEntries(groups);
  }

  summarizeVerifications(verifications) {
    return {
      total: verifications.length,
      passed: verifications.filter(v => v.status === 'passed').length,
      failed: verifications.filter(v => v.status === 'failed').length,
      recent: verifications.slice(0, 5).map(v => ({
        archiveId: v.archiveId,
        status: v.status,
        startTime: v.startTime,
        duration: v.endTime - v.startTime,
        checks: v.checks
      }))
    };
  }

  summarizeRecoveries(recoveries) {
    return {
      total: recoveries.length,
      successful: recoveries.filter(r => r.status === 'completed').length,
      failed: recoveries.filter(r => r.status === 'failed').length,
      recent: recoveries.slice(0, 5).map(r => ({
        archiveId: r.archiveId,
        status: r.status,
        startTime: r.startTime,
        endTime: r.endTime,
        processed: r.result?.processed || 0,
        errors: r.result?.errors?.length || 0
      }))
    };
  }

  async updateMetrics() {
    try {
      const stats = await this.getBackupStats('24h');
      
      // Update Prometheus metrics
      this.metrics.backupSize.set(stats.summary.totalSize);
      this.metrics.backupSuccess.inc(stats.verifications.passed);
      this.metrics.backupFailure.inc(stats.verifications.failed);

      for (const verification of stats.verifications.recent) {
        this.metrics.verificationStatus.set(
          { archive: verification.archiveId.toString() },
          verification.status === 'passed' ? 1 : 0
        );
      }
    } catch (error) {
      logger.error('Error updating backup metrics:', error);
    }
  }

  startMetricsUpdate() {
    // Update metrics every 5 minutes
    setInterval(() => {
      this.updateMetrics().catch(error => {
        logger.error('Error in metrics update:', error);
      });
    }, 5 * 60 * 1000);
  }
}

export const backupMonitoring = new BackupMonitoringService(); 