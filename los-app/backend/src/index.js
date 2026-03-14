require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const collateralRoutes = require('./routes/collateral');
const conditionRoutes = require('./routes/conditions');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const reportingRoutes = require('./routes/reporting');
const {
  apiRateLimiter,
  authRateLimiter,
  sensitiveOpRateLimiter,
  requestIdMiddleware,
  sanitizeInput,
  getHelmetConfig,
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 4000;

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Security Middleware ──────────────────────────────────────────

// Request ID tracing — unique ID on every request for audit correlation
app.use(requestIdMiddleware);

// Helmet — enterprise security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet(getHelmetConfig()));

// CORS — restrict to explicit frontend origin only
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 600, // Preflight cache: 10 minutes
}));

// Request logging (non-sensitive)
app.use(morgan('dev'));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization — strip XSS vectors from request bodies and query strings
app.use(sanitizeInput);

// ── Rate Limiting ────────────────────────────────────────────────

// General API rate limiter (300 req / 15 min)
app.use('/api/', apiRateLimiter);

// Stricter rate limiter on auth endpoints (10 req / 15 min)
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// Sensitive operations rate limiter (5 req / 15 min)
app.use('/api/admin/users', sensitiveOpRateLimiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── API Routes ───────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/collateral', collateralRoutes);
app.use('/api/conditions', conditionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reporting', reportingRoutes);

// Health check — does not expose internal details
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── Error Handling ───────────────────────────────────────────────

// Global error handler — never leak stack traces or internal details
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
    requestId: req.requestId,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', requestId: req.requestId });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`LOS Backend running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
