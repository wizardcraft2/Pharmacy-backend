import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 50 },  // Ramp up to 50 users
    { duration: '3m', target: 50 },  // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '3m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    errors: ['rate<0.1'],             // Error rate should be below 10%
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:5000';

export function setup() {
  // Login to get auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'test@example.com',
    password: 'password123',
  });

  check(loginRes, {
    'login successful': (r) => r.status === 200 && r.json('token'),
  });

  return { token: loginRes.json('token') };
}

export default function(data) {
  const params = {
    headers: {
      'Authorization': `Bearer ${data.token}`,
    },
  };

  const responses = http.batch([
    ['GET', `${BASE_URL}/api/v1/drugs`, null, params],
    ['GET', `${BASE_URL}/api/v1/manufacturers`, null, params],
    ['GET', `${BASE_URL}/api/v1/drugs/search?q=test`, null, params],
  ]);

  responses.forEach((res, index) => {
    const checks = check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!checks);
  });

  sleep(1);
}

export function teardown(data) {
  // Cleanup if needed
} 