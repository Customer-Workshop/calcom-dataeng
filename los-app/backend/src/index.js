require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const collateralRoutes = require('./routes/collateral');
const conditionRoutes = require('./routes/conditions');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const reportingRoutes = require('./routes/reporting');
const { db, getPoolStats } = require('./config/database');
const { getStats: getCacheStats } = require('./config/cache');
const { getAllBreakerStatus } = require('./config/circuitBreaker');
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

// Track server state for graceful shutdown
let isShuttingDown = false;

// Track active connections for graceful drain
let activeConnections = 0;
const MAX_CONCURRENT_REQUESTS = parseInt(process.env.MAX_CONCURRENT_REQUESTS || '500');
const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '30000');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ── Backpressure Middleware ──────────────────────────────────────

/**
 * Reject new requests when the server is shutting down or overloaded.
 * Returns 503 with Retry-After header for load balancer awareness.
 */
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({ error: 'Server is shutting down', retryAfter: 5 });
  }
  if (activeConnections >= MAX_CONCURRENT_REQUESTS) {
    return res.status(503).json({
      error: 'Server is at capacity. Please retry shortly.',
      retryAfter: 2,
    });
  }
  activeConnections++;
  res.on('finish', () => { activeConnections--; });
  next();
});

// ── Request Timeout ─────────────────────────────────────────────

/**
 * Enforce a maximum request duration to prevent slow requests from
 * holding connections indefinitely under high load.
 */
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout', requestId: req.requestId });
    }
  });
  next();
});

// ── Security Middleware ──────────────────────────────────────────

// Request ID tracing — unique ID on every request for audit correlation
app.use(requestIdMiddleware);

// Helmet — enterprise security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet(getHelmetConfig()));

// ── Response Compression ────────────────────────────────────────

/**
 * Gzip/Brotli compression for all responses > 1 KB.
 * Reduces bandwidth by 60-80% for JSON API responses.
 * Critical for 5000+ users to reduce network throughput.
 */
app.use(compression({
  level: 6,              // Balance between speed and compression ratio
  threshold: 1024,       // Only compress responses > 1 KB
  filter: (req, res) => {
    // Skip compression for SSE or streaming responses
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// CORS — restrict to explicit frontend origin only
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  maxAge: 600, // Preflight cache: 10 minutes
}));

// Request logging — use 'combined' in production for structured logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Input sanitization — strip XSS vectors from request bodies and query strings
app.use(sanitizeInput);

// ── Rate Limiting ────────────────────────────────────────────────

// General API rate limiter (scaled for 5000+ users)
app.use('/api/', apiRateLimiter);

// Stricter rate limiter on auth endpoints
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', authRateLimiter);

// Sensitive operations rate limiter
app.use('/api/admin/users', sensitiveOpRateLimiter);

// Static files for uploads — with immutable caching for uploaded docs
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '7d',
  immutable: true,
}));

// ── API Routes ───────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/collateral', collateralRoutes);
app.use('/api/conditions', conditionRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reporting', reportingRoutes);

// ── Health / Readiness / Liveness Endpoints ─────────────────────

/**
 * Liveness probe — indicates the process is running.
 * Used by load balancers / orchestrators (e.g., K8s livenessProbe).
 * Fast, no external dependencies.
 */
app.get('/api/health/live', (req, res) => {
  res.json({ status: 'alive', pid: process.pid });
});

/**
 * Readiness probe — indicates the app can serve traffic.
 * Checks database connectivity before declaring ready.
 * Used by load balancers to route traffic only to healthy instances.
 */
app.get('/api/health/ready', async (req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ready', pid: process.pid });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: 'Database connection failed' });
  }
});

/**
 * Detailed health check with system metrics.
 * Includes DB pool stats, cache stats, circuit breaker states, memory usage.
 * Intended for monitoring dashboards (Grafana, Datadog, etc.).
 */
app.get('/api/health', async (req, res) => {
  const memUsage = process.memoryUsage();
  let dbStatus = 'ok';
  try {
    await db.raw('SELECT 1');
  } catch (err) {
    dbStatus = 'error';
  }

  res.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '1.1.0',
    pid: process.pid,
    uptime: Math.floor(process.uptime()),
    activeConnections,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
    database: {
      status: dbStatus,
      pool: getPoolStats(),
    },
    cache: getCacheStats(),
    circuitBreakers: getAllBreakerStatus(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(memUsage.external / 1024 / 1024) + ' MB',
    },
  });
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

// ── Graceful Shutdown ───────────────────────────────────────────

/**
 * Graceful shutdown sequence:
 * 1. Stop accepting new connections
 * 2. Wait for active requests to drain (up to 10s)
 * 3. Close database connection pool
 * 4. Exit process
 */
let server;

function gracefulShutdown(signal) {
  console.log(`\n${signal} received — starting graceful shutdown...`);
  isShuttingDown = true;

  // Stop accepting new connections
  if (server) {
    server.close(() => {
      console.log('HTTP server closed — no new connections accepted');
    });
  }

  // Wait for active connections to drain, then close DB pool
  const drainInterval = setInterval(() => {
    if (activeConnections === 0) {
      clearInterval(drainInterval);
      closeAndExit();
    }
  }, 500);

  // Force exit after 10 seconds if connections haven't drained
  setTimeout(() => {
    clearInterval(drainInterval);
    console.warn(`Forcing shutdown with ${activeConnections} active connections`);
    closeAndExit();
  }, 10000);
}

function closeAndExit() {
  db.destroy()
    .then(() => {
      console.log('Database pool closed. Goodbye.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Error closing database pool:', err.message);
      process.exit(1);
    });
}

// Start server
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`LOS Backend running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Max concurrent requests: ${MAX_CONCURRENT_REQUESTS}`);
    console.log(`Request timeout: ${REQUEST_TIMEOUT_MS}ms`);
    console.log(`DB pool: min=${process.env.POOL_MIN || 5}, max=${process.env.POOL_MAX || 50}`);
  });

  // Keep-alive timeout should exceed the load balancer's idle timeout
  server.keepAliveTimeout = 65000;  // 65s (AWS ALB default is 60s)
  server.headersTimeout = 66000;    // Slightly above keepAliveTimeout

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Export internals for testing
app._testInternals = {
  gracefulShutdown,
  closeAndExit,
  getIsShuttingDown: () => isShuttingDown,
  setIsShuttingDown: (v) => { isShuttingDown = v; },
  getActiveConnections: () => activeConnections,
  setActiveConnections: (v) => { activeConnections = v; },
  getServer: () => server,
  setServer: (v) => { server = v; },
};

module.exports = app;
