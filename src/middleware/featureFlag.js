import { featureFlags } from '../services/featureFlags';

export const requireFeature = (flag) => {
  return async (req, res, next) => {
    const context = {
      userId: req.user?.id,
      role: req.user?.role,
      environment: process.env.NODE_ENV,
    };

    const isEnabled = await featureFlags.isEnabled(flag, context);

    if (!isEnabled) {
      return res.status(403).json({
        error: 'Feature Not Available',
        message: 'This feature is not currently available'
      });
    }

    next();
  };
}; 