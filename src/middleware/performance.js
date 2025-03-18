import { trace } from '@opentelemetry/api';
import { performance } from 'perf_hooks';

export const performanceMonitoring = () => {
  return (req, res, next) => {
    const startTime = performance.now();
    const tracer = trace.getTracer('http-middleware');

    const span = tracer.startSpan(`${req.method} ${req.path}`);
    span.setAttribute('http.method', req.method);
    span.setAttribute('http.url', req.url);
    span.setAttribute('http.route', req.route?.path);

    // Add trace context to response headers
    const traceId = span.spanContext().traceId;
    res.setHeader('X-Trace-ID', traceId);

    // Collect response metrics
    res.on('finish', () => {
      const duration = performance.now() - startTime;
      
      span.setAttribute('http.status_code', res.statusCode);
      span.setAttribute('http.duration_ms', duration);
      
      // Record custom metrics
      if (res.statusCode >= 500) {
        span.setAttribute('error', true);
        span.setAttribute('error.type', 'server_error');
      }

      span.end();
    });

    next();
  };
}; 