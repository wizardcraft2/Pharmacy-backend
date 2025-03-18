import { metrics } from '../middleware/metrics';
import { captureException } from './sentry';
import logger from './logger';

class PerformanceBudgetService {
  constructor() {
    this.budgets = {
      responseTime: {
        p95: 500,  // 95th percentile response time in ms
        p99: 1000  // 99th percentile response time in ms
      },
      errorRate: {
        critical: 0.05,  // 5% error rate
        warning: 0.02    // 2% error rate
      },
      memory: {
        warning: 0.85,   // 85% memory usage
        critical: 0.95   // 95% memory usage
      },
      cpu: {
        warning: 0.70,   // 70% CPU usage
        critical: 0.90   // 90% CPU usage
      }
    };

    this.violations = new Map();
    this.startMonitoring();
  }

  async checkBudgets() {
    try {
      const metrics = await this.collectMetrics();
      const violations = this.evaluateMetrics(metrics);
      
      if (violations.length > 0) {
        this.handleViolations(violations);
      }

      return violations;
    } catch (error) {
      logger.error('Error checking performance budgets:', error);
      captureException(error);
    }
  }

  async collectMetrics() {
    // Collect metrics from Prometheus client
    const responseTimeP95 = await metrics.apiRequestDuration.get();
    const errorCount = await metrics.apiRequestsTotal.get();
    const totalRequests = await metrics.apiRequestsTotal.get();
    
    const memory = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      responseTimeP95: responseTimeP95.values[0].value,
      errorRate: errorCount / totalRequests,
      memoryUsage: memory.heapUsed / memory.heapTotal,
      cpuUsage: (cpuUsage.user + cpuUsage.system) / 1000000 // Convert to seconds
    };
  }

  evaluateMetrics(metrics) {
    const violations = [];

    // Check response time
    if (metrics.responseTimeP95 > this.budgets.responseTime.p95) {
      violations.push({
        type: 'responseTime',
        level: metrics.responseTimeP95 > this.budgets.responseTime.p99 ? 'critical' : 'warning',
        value: metrics.responseTimeP95,
        threshold: this.budgets.responseTime.p95,
        message: `Response time P95 (${metrics.responseTimeP95}ms) exceeds budget (${this.budgets.responseTime.p95}ms)`
      });
    }

    // Check error rate
    if (metrics.errorRate > this.budgets.errorRate.warning) {
      violations.push({
        type: 'errorRate',
        level: metrics.errorRate > this.budgets.errorRate.critical ? 'critical' : 'warning',
        value: metrics.errorRate,
        threshold: this.budgets.errorRate.warning,
        message: `Error rate (${(metrics.errorRate * 100).toFixed(2)}%) exceeds budget (${(this.budgets.errorRate.warning * 100).toFixed(2)}%)`
      });
    }

    // Check memory usage
    if (metrics.memoryUsage > this.budgets.memory.warning) {
      violations.push({
        type: 'memory',
        level: metrics.memoryUsage > this.budgets.memory.critical ? 'critical' : 'warning',
        value: metrics.memoryUsage,
        threshold: this.budgets.memory.warning,
        message: `Memory usage (${(metrics.memoryUsage * 100).toFixed(2)}%) exceeds budget (${(this.budgets.memory.warning * 100).toFixed(2)}%)`
      });
    }

    return violations;
  }

  handleViolations(violations) {
    violations.forEach(violation => {
      const key = `${violation.type}:${violation.level}`;
      const now = Date.now();

      // Check if we've recently reported this violation
      if (this.violations.has(key)) {
        const lastReport = this.violations.get(key);
        if (now - lastReport < 5 * 60 * 1000) { // 5 minutes cooldown
          return;
        }
      }

      this.violations.set(key, now);
      
      // Log violation
      logger.warn('Performance budget violation:', violation);

      // Report to monitoring system
      if (violation.level === 'critical') {
        captureException(new Error(`Performance budget violation: ${violation.message}`));
      }
    });
  }

  startMonitoring() {
    // Check budgets every minute
    setInterval(() => {
      this.checkBudgets().catch(error => {
        logger.error('Error in performance budget monitoring:', error);
      });
    }, 60 * 1000);
  }
}

export const performanceBudget = new PerformanceBudgetService(); 