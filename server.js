// Loads .env, then .env.local on top - see scripts/env.js for why dotenv
// needs telling.
require('./scripts/env');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./server/routes/auth');
const leadRoutes = require('./server/routes/leads');
const taskRoutes = require('./server/routes/tasks');
const webhookRoutes = require('./server/routes/webhooks');
const userRoutes = require('./server/routes/users');
const importRoutes = require('./server/routes/import');
const adminRoutes = require('./server/routes/admin');

const siteContent = require('./server/lib/content');
const settings = require('./server/lib/settings');

const app = express();
const PORT = process.env.PORT || 4000;
const IS_DEV = process.env.NODE_ENV === 'development';

// === ENV VALIDATION ===
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start.');
  process.exit(1);
}
const CLIENT_URL = process.env.CLIENT_URL || 'https://www.projectnidos.eu';

// === SECURITY MIDDLEWARE ===
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // Locally we serve plain HTTP, and helmet's default
      // upgrade-insecure-requests makes Safari rewrite every asset URL to
      // https://localhost - which nothing answers, so the page loads bare.
      ...(IS_DEV && { upgradeInsecureRequests: null }),
    },
  },
  // HSTS on localhost only risks pinning the dev host to https.
  strictTransportSecurity: !IS_DEV,
  crossOriginEmbedderPolicy: false,
}));

// === RATE LIMITING ===
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth/login', authLimiter);

const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many submissions. Please try again later.'
});
app.use('/api/webhooks', webhookLimiter);

// The admin dashboard fires several reads on load and on every filter change.
// Under the shared 100/15min it would spend the budget one operator at a time,
// so it gets its own, wider allowance.
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/admin', adminLimiter);

// === CORS ===
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

// === BODY PARSING ===
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());


// === STATIC FILE SERVING — SECURE WHITELIST ===
const SAFE_EXTENSIONS = [
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.gif',
  '.ico', '.webp', '.xml', '.txt', '.json', '.woff', '.woff2', '.mp4'
];
const BLOCKED_PREFIXES = ['/server/', '/node_modules/', '/prisma/', '/scripts/', '/.git/'];
// Matched on basename, so anything listed here is blocked at EVERY path. The
// server's own sources used to be listed - but 'auth.js' and 'crm.js' are also
// the names of the browser scripts login.html and crm.html load, so the CRM was
// served with its JavaScript 404ing. BLOCKED_PREFIXES already covers /server/,
// which is where the route files those entries meant actually live.
const BLOCKED_FILES = [
  '.gitignore', '.dockerignore', 'Dockerfile', 'package.json',
  'package-lock.json', 'dev.db', 'prisma.config.ts', 'crm prompt.rtf',
  'server.js'
];
// Anything starting with one of these is blocked whatever follows it. The list
// above used to spell out '.env', '.env.example' and '.env.production' by name,
// which left '.env.local' - and every future variant - off it.
const BLOCKED_PATTERNS = ['.env'];

app.use((req, res, next) => {
  const urlPath = req.path.toLowerCase();

  /* This guard is about files on disk. API routes are not files, and the
     extension check below would 404 any of them that ends in something not on
     the whitelist - /api/admin/data/export/leads.csv, for one. */
  if (urlPath.startsWith('/api/')) return next();

  for (const prefix of BLOCKED_PREFIXES) {
    if (urlPath.startsWith(prefix)) {
      return res.status(404).send('Not found');
    }
  }

  const fileName = path.basename(urlPath);
  for (const blocked of BLOCKED_FILES) {
    if (fileName.toLowerCase() === blocked.toLowerCase()) {
      return res.status(404).send('Not found');
    }
  }
  for (const prefix of BLOCKED_PATTERNS) {
    if (fileName.toLowerCase().startsWith(prefix)) {
      return res.status(404).send('Not found');
    }
  }

  const ext = path.extname(urlPath).toLowerCase();
  if (ext && !SAFE_EXTENSIONS.includes(ext)) {
    return res.status(404).send('Not found');
  }

  next();
});

/* The site gate's password lives in Settings now. Serving the script through a
   route rather than as a static file keeps the gate synchronous - it still
   locks the page at parse time, with no fetch and no flash of the content it
   is meant to be hiding. Switching the gate off returns an empty script. */
let gateSource = null;
app.get('/gate.js', async (req, res) => {
  try {
    if (gateSource === null) {
      gateSource = require('fs').readFileSync(path.join(__dirname, 'gate.js'), 'utf8');
    }
    const enabled = await settings.get('gate.enabled');
    const password = await settings.get('gate.password');

    res.type('application/javascript');
    res.setHeader('Cache-Control', 'no-cache'); // the password can change at any time
    res.send(enabled
      ? gateSource.replace("'__GATE_PASSWORD__'", JSON.stringify(String(password)))
      : '/* site gate disabled */');
  } catch (err) {
    console.error('Gate script failed:', err.message);
    res.type('application/javascript').send('/* site gate unavailable */');
  }
});

/* Editable copy for the marketing pages. Must sit in front of express.static,
   or the file on disk wins and every override is invisible. Unmanaged paths
   fall straight through. */
app.use(siteContent.middleware);

app.use(express.static(path.join(__dirname), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff2?|mp4|webp)$/)) {
      // Every one of these is requested through a versioned URL (?v=NN) or a
      // name that changes with its content, so a new build is a new URL and a
      // guaranteed cache miss. Editing one WITHOUT bumping its ?v= is the only
      // way to strand a visitor on a stale copy - so bump it.
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// === PUBLIC PAGES ===
const PUBLIC_PAGES = ['/', '/index.html', '/index-lv.html', '/index-en.html'];

app.get(PUBLIC_PAGES, (req, res) => {
  let file = 'index.html';
  if (req.path === '/index-lv.html') file = 'index-lv.html';
  else if (req.path === '/index-en.html') file = 'index-en.html';
  res.sendFile(path.join(__dirname, file));
});

/* Internal pages. "Protected" only in the sense that they are useless without a
   session - the shell is public, every byte of data behind it is not. The admin
   panel additionally checks the role server-side on every /api/admin call. */
const CRM_PAGES = ['/crm.html', '/admin.html', '/login.html',
                   '/404.html', '/google5a35a94b98999dca.html'];

app.get(CRM_PAGES, (req, res) => {
  const file = path.basename(req.path);
  res.sendFile(path.join(__dirname, file));
});

// Favicon
app.get('/favicon.svg', (req, res) => {
  res.sendFile(path.join(__dirname, 'favicon.svg'));
});

// Robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send("User-agent: *\nAllow: /\nAllow: /nidos/\nAllow: /index-en.html\n\nSitemap: https://www.projectnidos.eu/sitemap.xml");
});

// Sitemap
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// === API ROUTES ===
app.get('/api', (req, res) => {
  res.json({ message: 'Project Nidos API is running', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/import-csv', importRoutes);
app.use('/api/admin', adminRoutes);

// === 404 for everything else ===
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// === GLOBAL ERROR HANDLER ===
app.use((err, req, res, next) => {
  /* A body the client sent wrong is the client's problem, and body-parser
     already says so via err.status - reporting it as a 500 sends the caller
     looking for a server fault that is not there. Anything without a status is
     genuinely ours, and its detail stays in the log. */
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error('Unhandled error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }

  res.status(status).json({ error: err.type === 'entity.parse.failed'
    ? 'Could not read the request body.'
    : (err.message || 'Bad request') });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`CORS origin: ${CLIENT_URL}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'MISSING!'}`);
});
