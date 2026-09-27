/*
 * Requests allowed per client address in a 15-minute (or hourly) window,
 * mounted before the routes (server.js).
 */
const rateLimit = require('express-rate-limit');

function applyRateLimits(app) {
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    // The admin panel's own allowance is below; its requests are not also counted here.
    skip: (req) => /^\/admin(\/|$)/.test(req.path),
  }));

  app.use('/api/auth/login', rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: 'Too many login attempts, please try again later.',
  }));

  app.use('/api/webhooks', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many submissions. Please try again later.',
  }));

  // The admin dashboard fires several reads on load and on every filter change,
  // and the page editor saves as often as someone works: under the shared
  // 100/15min it would spend the budget one operator at a time, so it gets its
  // own, wider allowance.
  app.use('/api/admin', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  }));
}

module.exports = { applyRateLimits };
