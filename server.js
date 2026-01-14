require('dotenv').config();
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

const app = express();
const PORT = process.env.PORT || 4000;

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disabling CSP for now to avoid breaking inline scripts/styles if any
}));

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit login attempts
  message: 'Too many login attempts, please try again later.'
});
app.use('/api/auth/login', authLimiter);

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || '*', // Restrict in production
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname))); // Serve static frontend files from current dir

// Health check for API root
app.get('/api', (req, res) => {
  res.json({ message: 'Project Nidos API is running', version: '1.0.0' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/webhooks', webhookRoutes);

// Fallback for SPA (if we had client-side routing, but we are using simple HTML files)
// For now, just serve index.html or crm.html if requested explicitly.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
