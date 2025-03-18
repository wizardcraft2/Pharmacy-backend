import { getWebSocketService } from './websocket';
import logger from './logger';

class RealTimeAnalyticsService {
  constructor() {
    this.metrics = {
      activeUsers: new Set(),
      requestsPerMinute: new Array(60).fill(0),
      errorCounts: new Map(),
      endpointUsage: new Map(),
      responseTimeAvg: new Map()
    };

    this.startPeriodicUpdates();
  }

  trackRequest(req, res, duration) {
    try {
      // Track active users
      if (req.user?.id) {
        this.metrics.activeUsers.add(req.user.id);
      }

      // Track requests per minute
      const currentMinute = new Date().getMinutes();
      this.metrics.requestsPerMinute[currentMinute]++;

      // Track endpoint usage
      const endpoint = `${req.method} ${req.path}`;
      this.metrics.endpointUsage.set(
        endpoint,
        (this.metrics.endpointUsage.get(endpoint) || 0) + 1
      );

      // Track response times
      const currentAvg = this.metrics.responseTimeAvg.get(endpoint) || 0;
      const currentCount = this.metrics.endpointUsage.get(endpoint) || 1;
      const newAvg = (currentAvg * (currentCount - 1) + duration) / currentCount;
      this.metrics.responseTimeAvg.set(endpoint, newAvg);

      // Track errors
      if (res.statusCode >= 400) {
        const errorKey = `${res.statusCode} - ${endpoint}`;
        this.metrics.errorCounts.set(
          errorKey,
          (this.metrics.errorCounts.get(errorKey) || 0) + 1
        );
      }

    } catch (error) {
      logger.error('Error tracking real-time analytics:', error);
    }
  }

  getMetrics() {
    return {
      activeUsers: this.metrics.activeUsers.size,
      requestsPerMinute: this.metrics.requestsPerMinute.reduce((a, b) => a + b, 0),
      topEndpoints: Array.from(this.metrics.endpointUsage.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      recentErrors: Array.from(this.metrics.errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5),
      averageResponseTimes: Array.from(this.metrics.responseTimeAvg.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }

  startPeriodicUpdates() {
    // Reset requests per minute counter every hour
    setInterval(() => {
      this.metrics.requestsPerMinute = new Array(60).fill(0);
    }, 60 * 60 * 1000);

    // Reset active users every day
    setInterval(() => {
      this.metrics.activeUsers.clear();
    }, 24 * 60 * 60 * 1000);

    // Broadcast metrics every 5 seconds
    setInterval(() => {
      this.broadcastMetrics();
    }, 5000);
  }

  broadcastMetrics() {
    try {
      const ws = getWebSocketService();
      const metrics = this.getMetrics();

      ws.broadcast({
        type: 'analytics',
        data: metrics
      });
    } catch (error) {
      logger.error('Error broadcasting metrics:', error);
    }
  }
}

export const realTimeAnalytics = new RealTimeAnalytics(); 