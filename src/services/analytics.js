import mongoose from 'mongoose';
import { metrics } from '../middleware/metrics';
import logger from './logger';

const AnalyticsSchema = new mongoose.Schema({
  endpoint: String,
  method: String,
  statusCode: Number,
  responseTime: Number,
  userId: String,
  userAgent: String,
  ip: String,
  timestamp: { type: Date, default: Date.now },
  params: Object,
  query: Object,
  error: String
}, { timestamps: true });

const Analytics = mongoose.model('Analytics', AnalyticsSchema);

class APIAnalyticsService {
  async trackRequest(req, res, duration) {
    try {
      const analytics = new Analytics({
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: duration,
        userId: req.user?.id,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        params: req.params,
        query: req.query,
        error: res.locals.error
      });

      await analytics.save();

      // Update Prometheus metrics
      metrics.apiRequestDuration
        .labels(req.method, req.path, res.statusCode.toString())
        .observe(duration);

      metrics.apiRequestsTotal
        .labels(req.method, req.path, res.statusCode.toString())
        .inc();

    } catch (error) {
      logger.error('Error tracking analytics:', error);
    }
  }

  async getAnalytics(options = {}) {
    const {
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate = new Date(),
      groupBy = 'endpoint'
    } = options;

    const pipeline = [
      {
        $match: {
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: `$${groupBy}`,
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' },
          errorCount: {
            $sum: {
              $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
            }
          },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          count: 1,
          avgResponseTime: 1,
          errorCount: 1,
          uniqueUsers: { $size: '$uniqueUsers' },
          errorRate: {
            $divide: ['$errorCount', '$count']
          }
        }
      },
      {
        $sort: { count: -1 }
      }
    ];

    return Analytics.aggregate(pipeline);
  }

  async getTopErrors(limit = 10) {
    return Analytics.find({ statusCode: { $gte: 400 } })
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('-__v');
  }

  async getUserJourney(userId) {
    return Analytics.find({ userId })
      .sort({ timestamp: 1 })
      .select('-__v');
  }
}

export const apiAnalytics = new APIAnalyticsService(); 