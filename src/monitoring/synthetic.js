import axios from 'axios';
import { performance } from 'perf_hooks';
import logger from '../services/logger';

class SyntheticMonitoring {
  constructor() {
    this.baseUrl = process.env.API_URL || 'http://localhost:5000';
    this.endpoints = [
      { path: '/health', method: 'GET' },
      { path: '/api/drugs', method: 'GET' },
      { path: '/api/manufacturers', method: 'GET' },
      { path: '/api/drugs/search?q=test', method: 'GET' },
    ];
  }

  async runChecks() {
    const results = [];
    
    for (const endpoint of this.endpoints) {
      try {
        const startTime = performance.now();
        const response = await axios({
          method: endpoint.method,
          url: `${this.baseUrl}${endpoint.path}`,
          validateStatus: false,
        });
        const duration = performance.now() - startTime;

        const result = {
          endpoint: endpoint.path,
          method: endpoint.method,
          status: response.status,
          duration,
          timestamp: new Date(),
          success: response.status >= 200 && response.status < 400,
        };

        results.push(result);
        this.reportMetrics(result);
      } catch (error) {
        logger.error(`Synthetic monitoring failed for ${endpoint.path}:`, error);
        
        results.push({
          endpoint: endpoint.path,
          method: endpoint.method,
          status: error.response?.status || 0,
          duration: 0,
          timestamp: new Date(),
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  reportMetrics(result) {
    // Add custom metrics for Prometheus
    if (global.promClient) {
      const { endpoint, method, status, duration, success } = result;
      
      global.promClient.endpointResponseTime
        .labels(endpoint, method, status.toString())
        .observe(duration);
      
      global.promClient.endpointAvailability
        .labels(endpoint, method)
        .set(success ? 1 : 0);
    }
  }
}

export const syntheticMonitoring = new SyntheticMonitoring(); 