import { apiAnalytics } from '../services/analytics';
import { performance } from 'perf_hooks';

export const analyticsMiddleware = () => {
  return (req, res, next) => {
    const start = performance.now();

    // Capture the original end function
    const originalEnd = res.end;

    // Override the end function
    res.end = function(...args) {
      const duration = performance.now() - start;
      
      // Track the request after it's complete
      apiAnalytics.trackRequest(req, res, duration).catch(console.error);
      
      // Call the original end function
      originalEnd.apply(res, args);
    };

    next();
  };
}; 