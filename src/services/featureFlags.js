import Redis from 'ioredis';
import logger from './logger';

class FeatureFlagService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      keyPrefix: 'feature:',
    });

    this.defaultFlags = {
      NEW_SEARCH_ALGORITHM: false,
      ADVANCED_ANALYTICS: false,
      REAL_TIME_UPDATES: false,
      BETA_FEATURES: false,
    };

    this.initialize();
  }

  async initialize() {
    try {
      // Set default flags if they don't exist
      const pipeline = this.redis.pipeline();
      
      for (const [flag, value] of Object.entries(this.defaultFlags)) {
        pipeline.setnx(flag, JSON.stringify({
          enabled: value,
          description: `Feature flag for ${flag}`,
          createdAt: new Date().toISOString(),
        }));
      }

      await pipeline.exec();
    } catch (error) {
      logger.error('Error initializing feature flags:', error);
    }
  }

  async isEnabled(flag, context = {}) {
    try {
      const flagData = await this.redis.get(flag);
      if (!flagData) return this.defaultFlags[flag] || false;

      const { enabled, rules = [] } = JSON.parse(flagData);
      
      // Check if any rules apply to the current context
      if (rules.length > 0 && context) {
        return this.evaluateRules(rules, context);
      }

      return enabled;
    } catch (error) {
      logger.error(`Error checking feature flag ${flag}:`, error);
      return this.defaultFlags[flag] || false;
    }
  }

  async setFlag(flag, value, rules = []) {
    try {
      await this.redis.set(flag, JSON.stringify({
        enabled: value,
        rules,
        updatedAt: new Date().toISOString(),
      }));
      
      logger.info(`Feature flag ${flag} updated to ${value}`);
      return true;
    } catch (error) {
      logger.error(`Error setting feature flag ${flag}:`, error);
      return false;
    }
  }

  evaluateRules(rules, context) {
    return rules.some(rule => {
      switch (rule.type) {
        case 'userPercentage':
          return this.evaluatePercentageRule(rule, context);
        case 'userRole':
          return context.role === rule.value;
        case 'environment':
          return process.env.NODE_ENV === rule.value;
        default:
          return false;
      }
    });
  }

  evaluatePercentageRule(rule, context) {
    if (!context.userId) return false;
    
    // Use consistent hashing for user percentage rules
    const hash = this.hashString(context.userId);
    const percentage = hash % 100;
    return percentage < rule.value;
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

export const featureFlags = new FeatureFlagService(); 