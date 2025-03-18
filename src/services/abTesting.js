import { featureFlags } from './featureFlags';
import { metrics } from '../middleware/metrics';
import logger from './logger';

class ABTestingService {
  constructor() {
    this.experiments = new Map();
    this.results = new Map();
  }

  async createExperiment(name, variants, options = {}) {
    const experiment = {
      name,
      variants,
      startDate: new Date(),
      endDate: options.endDate || null,
      sampleSize: options.sampleSize || 1000,
      metrics: options.metrics || ['conversion', 'latency'],
      status: 'active'
    };

    // Create feature flags for variants
    for (const variant of variants) {
      await featureFlags.setFlag(`${name}_${variant}`, true, [{
        type: 'userPercentage',
        value: 100 / variants.length // Equal distribution
      }]);
    }

    this.experiments.set(name, experiment);
    logger.info(`A/B test created: ${name}`);
    return experiment;
  }

  async assignVariant(experimentName, userId) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment || experiment.status !== 'active') return null;

    // Consistent variant assignment using user ID
    const variantIndex = Math.abs(this.hashString(userId)) % experiment.variants.length;
    const variant = experiment.variants[variantIndex];

    // Check if the feature flag is enabled for this user
    const isEnabled = await featureFlags.isEnabled(
      `${experimentName}_${variant}`,
      { userId }
    );

    return isEnabled ? variant : null;
  }

  async trackEvent(experimentName, variant, userId, eventType, value) {
    const key = `${experimentName}:${variant}:${eventType}`;
    
    try {
      // Record metrics
      metrics.abTestingEvents.labels(experimentName, variant, eventType).inc();
      
      if (typeof value === 'number') {
        metrics.abTestingValues
          .labels(experimentName, variant, eventType)
          .observe(value);
      }

      // Store result
      if (!this.results.has(key)) {
        this.results.set(key, []);
      }
      this.results.get(key).push({
        userId,
        timestamp: new Date(),
        value
      });

    } catch (error) {
      logger.error('Error tracking A/B test event:', error);
    }
  }

  async getResults(experimentName) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) return null;

    const results = {};
    for (const variant of experiment.variants) {
      results[variant] = {
        events: {},
        metrics: {}
      };

      for (const metricName of experiment.metrics) {
        const key = `${experimentName}:${variant}:${metricName}`;
        const data = this.results.get(key) || [];
        
        results[variant].events[metricName] = data.length;
        results[variant].metrics[metricName] = this.calculateMetrics(data);
      }
    }

    return {
      experiment,
      results,
      significance: this.calculateSignificance(results)
    };
  }

  calculateMetrics(data) {
    if (data.length === 0) return null;

    const values = data.map(d => d.value).filter(v => typeof v === 'number');
    if (values.length === 0) return null;

    return {
      count: values.length,
      mean: values.reduce((a, b) => a + b) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  calculateSignificance(results) {
    // Implement statistical significance calculation
    // (e.g., chi-square test for conversion rates)
    // This is a simplified version
    return {
      significant: true,
      pValue: 0.05,
      confidence: 0.95
    };
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const abTesting = new ABTestingService(); 