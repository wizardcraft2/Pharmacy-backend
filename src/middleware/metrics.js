import promBundle from 'express-prom-bundle';
import client from 'prom-client';

// Create custom metrics
const dbOperationDuration = new client.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'model']
});

const apiRequestDuration = new client.Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Configure metrics middleware
export const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  includeUp: true,
  customLabels: { app: 'pharmacy-wiki-api' },
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000
    }
  }
});

export const metrics = {
  dbOperationDuration,
  apiRequestDuration,
  activeConnections
}; 