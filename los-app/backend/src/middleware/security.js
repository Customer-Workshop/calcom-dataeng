const rateLimit = require('express-rate-limit');
const { generateRequestId } = require('../utils/encryption');
const { createAuditLog } = require('../utils/audit');
const { db } = require('../config/database');

/**
 * Enterprise security middleware for the LOS application.
 * Implements rate limiting, account lockout, request tracing,
 * input sanitization, and security event logging.
 */

// ──────────────────────────────────────────────
// Rate Limiting
// ──────────────────────────────────────────────

/**
 * Strict rate limiter for authentication endpoints.
 * Limits to 20 requests per 15-minute window to prevent brute-force attacks.
 * Scaled up from 10 to support concurrent login waves (shift changes, etc.).
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_AUTH || '20'),
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination to prevent distributed attacks
    const email = req.body && req.body.email ? req.body.email.toLowerCase() : '';
    return `${req.ip}-${email}`;
  },
});

/**
 * Strict rate limiter for sensitive operations (password changes, user creation).
 */
const sensitiveOpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_SENSITIVE || '10'),
  message: {
    error: 'Too many sensitive operations. Please try again later.',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter — scaled for 5000+ concurrent users.
 * 1000 requests per 15-minute window per IP.
 */
const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_API || '1000'),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ──────────────────────────────────────────────
// Account Lockout
// ──────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

/**
 * Check if an account is locked due to too many failed login attempts.
 * Returns { locked: boolean, remainingMinutes: number }
 */
async function checkAccountLockout(email) {
  try {
    const user = await db('users').where('email', email).first();
    if (!user) return { locked: false, remainingMinutes: 0 };

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return { locked: true, remainingMinutes: remaining };
    }

    // If lockout has expired, reset the counter
    if (user.locked_until && new Date(user.locked_until) <= new Date()) {
      await db('users').where('id', user.id).update({
        failed_login_attempts: 0,
        locked_until: null,
      });
    }

    return { locked: false, remainingMinutes: 0 };
  } catch (err) {
    console.error('Account lockout check failed:', err.message);
    return { locked: false, remainingMinutes: 0 };
  }
}

/**
 * Record a failed login attempt. Locks the account after MAX_FAILED_ATTEMPTS.
 */
async function recordFailedLogin(email, ipAddress) {
  try {
    const user = await db('users').where('email', email).first();
    if (!user) return;

    const attempts = (user.failed_login_attempts || 0) + 1;
    const updates = { failed_login_attempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + LOCKOUT_DURATION_MINUTES);
      updates.locked_until = lockUntil;

      await createAuditLog({
        userId: user.id,
        userEmail: email,
        action: 'account_locked',
        entityType: 'user',
        entityId: user.id,
        details: { reason: 'max_failed_login_attempts', attempts, lockout_minutes: LOCKOUT_DURATION_MINUTES },
        ipAddress,
      });
    }

    await db('users').where('id', user.id).update(updates);

    await createAuditLog({
      userId: user.id,
      userEmail: email,
      action: 'login_failed',
      entityType: 'user',
      entityId: user.id,
      details: { attempts, ip: ipAddress },
      ipAddress,
    });
  } catch (err) {
    console.error('Record failed login error:', err.message);
  }
}

/**
 * Reset failed login counter on successful authentication.
 */
async function resetFailedLogins(userId) {
  try {
    await db('users').where('id', userId).update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login: new Date(),
    });
  } catch (err) {
    console.error('Reset failed logins error:', err.message);
  }
}

// ──────────────────────────────────────────────
// Request ID Tracing
// ──────────────────────────────────────────────

/**
 * Attach a unique request ID to every request for traceability in logs and audit trail.
 */
function requestIdMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
}

// ──────────────────────────────────────────────
// Input Sanitization (XSS Prevention)
// ──────────────────────────────────────────────

/**
 * Strip common XSS vectors from string values in request body.
 * Does NOT replace proper output encoding — this is defense-in-depth.
 */
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitizeObject(req.query);
  }
  next();
}

function sanitizeObject(obj) {
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      // Remove script tags and event handlers
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '')
        .replace(/javascript\s*:/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

// ──────────────────────────────────────────────
// Security Event Logger
// ──────────────────────────────────────────────

/**
 * Log a security event to the audit trail with severity classification.
 */
async function logSecurityEvent({ userId, userEmail, event, severity, details, ipAddress, requestId }) {
  try {
    await createAuditLog({
      userId,
      userEmail,
      action: `security:${event}`,
      entityType: 'security',
      entityId: userId || 0,
      details: JSON.stringify({
        severity, // 'info', 'warning', 'critical'
        ...details,
        requestId,
        timestamp: new Date().toISOString(),
      }),
      ipAddress,
    });
  } catch (err) {
    console.error('Security event logging failed:', err.message);
  }
}

// ──────────────────────────────────────────────
// Enhanced Helmet Configuration
// ──────────────────────────────────────────────

/**
 * Returns helmet configuration object for enterprise-grade security headers.
 */
function getHelmetConfig() {
  return {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind uses inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    // Strict-Transport-Security (HSTS)
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // X-Frame-Options
    frameguard: { action: 'deny' },
    // X-Content-Type-Options: nosniff
    noSniff: true,
    // Referrer-Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // X-DNS-Prefetch-Control
    dnsPrefetchControl: { allow: false },
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: false, // Disabled to allow image loading
    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: 'same-origin' },
  };
}

// ──────────────────────────────────────────────
// Password Policy
// ──────────────────────────────────────────────

const PASSWORD_POLICY = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * Validate a password against enterprise password policy.
 * Returns { valid: boolean, errors: string[] }
 */
function validatePasswordPolicy(password) {
  const errors = [];

  if (!password || password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Password must be at least ${PASSWORD_POLICY.minLength} characters long`);
  }
  if (password && password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Password must not exceed ${PASSWORD_POLICY.maxLength} characters`);
  }
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (PASSWORD_POLICY.requireDigit && !/\d/.test(password)) {
    errors.push('Password must contain at least one digit');
  }
  if (PASSWORD_POLICY.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  authRateLimiter,
  sensitiveOpRateLimiter,
  apiRateLimiter,
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLogins,
  requestIdMiddleware,
  sanitizeInput,
  logSecurityEvent,
  getHelmetConfig,
  validatePasswordPolicy,
  PASSWORD_POLICY,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
};
