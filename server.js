require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const authRoutes = require('./server/routes/auth');
const leadRoutes = require('./server/routes/leads');
const taskRoutes = require('./server/routes/tasks');
const webhookRoutes = require('./server/routes/webhooks');

const app = express();
const PORT = process.env.PORT || 4000;

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
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
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

// === CORS ===
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));

// === BODY PARSING ===
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// === GZIP COMPRESSION ===
app.use(compression());

// === STATIC FILE SERVING — SECURE WHITELIST ===
const SAFE_EXTENSIONS = [
  '.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.gif',
  '.ico', '.webp', '.xml', '.txt', '.json', '.woff', '.woff2'
];
const BLOCKED_PREFIXES = ['/server/', '/node_modules/', '/prisma/', '/.git/'];
const BLOCKED_FILES = [
  '.env', '.env.example', '.env.production', '.gitignore', '.dockerignore',
  'Dockerfile', 'package.json', 'package-lock.json', 'dev.db',
  'prisma.config.ts', 'crm prompt.rtf',
  'server.js', 'auth.js', 'crm.js', 'leads.js', 'tasks.js', 'webhooks.js'
];

app.use((req, res, next) => {
  const urlPath = req.path.toLowerCase();

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

  const ext = path.extname(urlPath).toLowerCase();
  if (ext && !SAFE_EXTENSIONS.includes(ext)) {
    return res.status(404).send('Not found');
  }

  next();
});

app.use(express.static(path.join(__dirname), {
  dotfiles: 'deny',
  index: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(css|js|svg|png|jpg|jpeg|gif|ico|woff2?)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
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

// === PROTECTED PAGES (auth handled client-side) ===
const CRM_PAGES = ['/crm.html', '/login.html', '/register.html', '/get-token.html',
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
app.use('/api/webhooks', webhookRoutes);

// === 404 for everything else ===
app.get('*', (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// === GLOBAL ERROR HANDLER ===
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`CORS origin: ${CLIENT_URL}`);
  console.log(`JWT_SECRET: ${process.env.JWT_SECRET ? 'SET' : 'MISSING!'}`);
});
