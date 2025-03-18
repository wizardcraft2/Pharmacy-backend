import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 1000,
      stages: [
        { duration: '2m', target: 10 },  // Below normal load
        { duration: '5m', target: 30 },  // Normal load
        { duration: '2m', target: 60 },  // Around breaking point
        { duration: '5m', target: 100 }, // Beyond breaking point
        { duration: '2m', target: 0 },   // Scale down
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    errors: ['rate<0.15'],             // Error rate should be below 15%
  },
};

// ... rest of the test implementation similar to load-test.js ... 