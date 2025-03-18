import mongoose from 'mongoose';
import { backupMonitoring } from './backupMonitoring';
import { backupHealth } from './backupHealth';
import logger from './logger';

class VisualizationDataService {
  async getBackupTimeline(timeRange = '7d') {
    try {
      const startDate = new Date(Date.now() - backupMonitoring.parseTimeRange(timeRange));
      
      const archives = await mongoose.model('Archive')
        .find({
          timestamp: { $gte: startDate }
        })
        .sort({ timestamp: 1 });

      return this.formatTimelineData(archives);
    } catch (error) {
      logger.error('Error getting backup timeline:', error);
      throw error;
    }
  }

  async getHealthTrends(timeRange = '7d') {
    try {
      const history = await backupHealth.getHealthHistory(timeRange);
      return this.formatHealthTrends(history);
    } catch (error) {
      logger.error('Error getting health trends:', error);
      throw error;
    }
  }

  async getStorageUsage(timeRange = '30d') {
    try {
      const startDate = new Date(Date.now() - backupMonitoring.parseTimeRange(timeRange));
      
      const archives = await mongoose.model('Archive')
        .find({
          timestamp: { $gte: startDate }
        })
        .sort({ timestamp: 1 });

      return this.formatStorageData(archives);
    } catch (error) {
      logger.error('Error getting storage usage:', error);
      throw error;
    }
  }

  formatTimelineData(archives) {
    const collections = new Set(archives.map(a => a.collectionName));
    const series = Array.from(collections).map(collection => ({
      name: collection,
      data: archives
        .filter(a => a.collectionName === collection)
        .map(a => ({
          x: a.timestamp,
          y: a.recordCount,
          size: a.size,
          id: a._id
        }))
    }));

    return {
      type: 'timeline',
      series
    };
  }

  formatHealthTrends(history) {
    const checks = new Set();
    history.forEach(h => h.checks.forEach(c => checks.add(c.name)));

    const series = Array.from(checks).map(check => ({
      name: check,
      data: history.map(h => {
        const checkResult = h.checks.find(c => c.name === check);
        return {
          x: h.timestamp,
          y: this.statusToValue(checkResult?.status),
          status: checkResult?.status,
          details: checkResult?.details
        };
      })
    }));

    return {
      type: 'health',
      series
    };
  }

  formatStorageData(archives) {
    const dailyUsage = new Map();
    
    archives.forEach(archive => {
      const date = archive.timestamp.toISOString().split('T')[0];
      const current = dailyUsage.get(date) || 0;
      dailyUsage.set(date, current + archive.size);
    });

    return {
      type: 'storage',
      series: [{
        name: 'Storage Usage',
        data: Array.from(dailyUsage.entries()).map(([date, size]) => ({
          x: date,
          y: size,
          formatted: this.formatBytes(size)
        }))
      }]
    };
  }

  statusToValue(status) {
    switch (status) {
      case 'healthy': return 1;
      case 'warning': return 0.5;
      case 'critical': return 0;
      default: return null;
    }
  }

  formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
      value /= 1024;
      unit++;
    }

    return `${value.toFixed(2)} ${units[unit]}`;
  }
}

export const visualizationData = new VisualizationDataService(); 