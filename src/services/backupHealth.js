import mongoose from 'mongoose';
import { backupMonitoring } from './backupMonitoring';
import { deliveryChannel } from './deliveryChannel';
import logger from './logger';

class BackupHealthService {
  constructor() {
    this.healthChecks = [
      {
        name: 'backup_frequency',
        check: this.checkBackupFrequency.bind(this),
        threshold: 24 * 60 * 60 * 1000 // 24 hours
      },
      {
        name: 'verification_success',
        check: this.checkVerificationSuccess.bind(this),
        threshold: 0.95 // 95% success rate
      },
      {
        name: 'storage_usage',
        check: this.checkStorageUsage.bind(this),
        threshold: 0.85 // 85% usage
      },
      {
        name: 'recovery_success',
        check: this.checkRecoverySuccess.bind(this),
        threshold: 0.9 // 90% success rate
      }
    ];

    this.alerts = new Set();
    this.startHealthChecks();
  }

  async runHealthChecks() {
    const results = {
      timestamp: new Date(),
      status: 'healthy',
      checks: [],
      alerts: []
    };

    for (const check of this.healthChecks) {
      try {
        const result = await check.check();
        results.checks.push({
          name: check.name,
          status: result.status,
          details: result.details,
          timestamp: new Date()
        });

        if (result.status === 'critical') {
          results.status = 'critical';
        } else if (result.status === 'warning' && results.status !== 'critical') {
          results.status = 'warning';
        }

        // Handle alerts
        if (result.status !== 'healthy') {
          this.handleAlert(check.name, result);
          results.alerts.push({
            name: check.name,
            level: result.status,
            message: result.details.message
          });
        } else {
          this.clearAlert(check.name);
        }

      } catch (error) {
        logger.error(`Error in health check ${check.name}:`, error);
        results.checks.push({
          name: check.name,
          status: 'error',
          details: { error: error.message },
          timestamp: new Date()
        });
      }
    }

    await this.saveHealthCheckResults(results);
    return results;
  }

  async checkBackupFrequency() {
    const lastBackup = await mongoose.model('Archive')
      .findOne()
      .sort({ timestamp: -1 });

    if (!lastBackup) {
      return {
        status: 'critical',
        details: {
          message: 'No backups found',
          lastBackup: null
        }
      };
    }

    const timeSinceLastBackup = Date.now() - lastBackup.timestamp;
    const status = timeSinceLastBackup > this.healthChecks[0].threshold
      ? 'critical'
      : timeSinceLastBackup > (this.healthChecks[0].threshold / 2)
        ? 'warning'
        : 'healthy';

    return {
      status,
      details: {
        message: `Last backup was ${Math.round(timeSinceLastBackup / (60 * 60 * 1000))} hours ago`,
        lastBackup: lastBackup.timestamp,
        threshold: this.healthChecks[0].threshold
      }
    };
  }

  async checkVerificationSuccess() {
    const stats = await backupMonitoring.getBackupStats('24h');
    const successRate = stats.verifications.passed / stats.verifications.total;

    return {
      status: successRate < this.healthChecks[1].threshold
        ? 'critical'
        : successRate < (this.healthChecks[1].threshold + 0.05)
          ? 'warning'
          : 'healthy',
      details: {
        message: `Verification success rate: ${(successRate * 100).toFixed(1)}%`,
        successRate,
        threshold: this.healthChecks[1].threshold
      }
    };
  }

  async checkStorageUsage() {
    const stats = await backupMonitoring.getBackupStats('24h');
    const usage = stats.summary.totalSize / (process.env.BACKUP_STORAGE_LIMIT || 1e12);

    return {
      status: usage > this.healthChecks[2].threshold
        ? 'critical'
        : usage > (this.healthChecks[2].threshold - 0.1)
          ? 'warning'
          : 'healthy',
      details: {
        message: `Storage usage: ${(usage * 100).toFixed(1)}%`,
        usage,
        threshold: this.healthChecks[2].threshold
      }
    };
  }

  async checkRecoverySuccess() {
    const stats = await backupMonitoring.getBackupStats('7d');
    const successRate = stats.recoveries.successful / stats.recoveries.total;

    return {
      status: successRate < this.healthChecks[3].threshold
        ? 'critical'
        : successRate < (this.healthChecks[3].threshold + 0.05)
          ? 'warning'
          : 'healthy',
      details: {
        message: `Recovery success rate: ${(successRate * 100).toFixed(1)}%`,
        successRate,
        threshold: this.healthChecks[3].threshold
      }
    };
  }

  async handleAlert(checkName, result) {
    const alertKey = `${checkName}:${result.status}`;
    
    if (!this.alerts.has(alertKey)) {
      this.alerts.add(alertKey);

      // Send alert notification
      await deliveryChannel.send('email', {
        subject: `Backup Health Alert: ${checkName}`,
        html: `
          <h2>Backup Health Alert</h2>
          <p><strong>Check:</strong> ${checkName}</p>
          <p><strong>Status:</strong> ${result.status}</p>
          <p><strong>Details:</strong> ${result.details.message}</p>
        `,
        metadata: {
          check: checkName,
          status: result.status,
          details: result.details
        }
      }, {
        to: process.env.ALERT_RECIPIENTS
      });
    }
  }

  clearAlert(checkName) {
    for (const alertKey of this.alerts) {
      if (alertKey.startsWith(checkName + ':')) {
        this.alerts.delete(alertKey);
      }
    }
  }

  async saveHealthCheckResults(results) {
    await mongoose.model('HealthCheck').create(results);
  }

  async getHealthHistory(timeRange = '24h') {
    const startDate = new Date(Date.now() - backupMonitoring.parseTimeRange(timeRange));
    
    return mongoose.model('HealthCheck')
      .find({
        timestamp: { $gte: startDate }
      })
      .sort({ timestamp: -1 });
  }

  startHealthChecks() {
    // Run health checks every 15 minutes
    setInterval(() => {
      this.runHealthChecks().catch(error => {
        logger.error('Error running health checks:', error);
      });
    }, 15 * 60 * 1000);
  }
}

export const backupHealth = new BackupHealthService(); 