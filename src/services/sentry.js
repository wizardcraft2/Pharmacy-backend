import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { Express as ExpressIntegration } from '@sentry/integrations';

export const initializeSentry = () => {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      new ProfilingIntegration(),
      new ExpressIntegration({
        // Transaction start/stop
        app: true,
        // Request data
        request: true,
        // Route parameters
        route: true,
      }),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    beforeSend(event) {
      // Sanitize sensitive data
      if (event.request && event.request.data) {
        delete event.request.data.password;
        delete event.request.data.token;
      }
      return event;
    },
  });
};

export const captureException = (error, context = {}) => {
  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
}; 