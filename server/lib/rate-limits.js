/*
 * Requests allowed per client address in a 15-minute (or hourly) window,
 * mounted before the routes (server.js).
 */
const rateLimit = require('express-rate-limit');

const BUSY = 'Too many messages have come from your connection in the last 15 minutes. '
  + 'Please try again later, or write to support@projectnidos.eu.';

/* On Railway every request arrives through its edge, so the connection is the
   proxy's and every visitor shared one allowance (express-rate-limit logged
   ERR_ERL_UNEXPECTED_X_FORWARDED_FOR). Trusting that one hop makes req.ip the
   address the edge itself saw - the last X-Forwarded-For entry - which a
   visitor cannot choose: anything they send in the header comes before it.
   Off Railway there is no proxy, so nothing is trusted. */
function applyRateLimits(app, { behindProxy = Boolean(process.env.RAILWAY_ENVIRONMENT_NAME) } = {}) {
  app.set('trust proxy', behindProxy ? 1 : false);

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
    // A plain post (no script) navigated the browser here, so its answer is a
    // sentence, like the form's other answers; the script reads JSON.
    handler: (req, res, next, options) => (req.is('urlencoded')
      ? res.status(options.statusCode).type('text').send(BUSY)
      : res.status(options.statusCode).json({ error: BUSY })),
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
