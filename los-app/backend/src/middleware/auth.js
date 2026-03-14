const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { db } = require('../config/database');
const { isTokenBlacklisted } = require('../utils/tokenBlacklist');

/**
 * Middleware: Verify JWT token, check blacklist, and attach user to request.
 * Rejects tokens that have been revoked via logout.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];

  // Check if token has been revoked (user logged out)
  if (isTokenBlacklisted(token)) {
    return res.status(401).json({ error: 'Token has been revoked' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    req.token = token; // Store token reference for logout/blacklisting
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: Require specific roles for access.
 * Enforces principle of least privilege — only named roles can proceed.
 * Logs unauthorized access attempts as security events.
 * @param  {...string} allowedRoles - Role names that can access the route
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      // Log privilege escalation attempt
      const { logSecurityEvent } = require('./security');
      logSecurityEvent({
        userId: req.user.id,
        userEmail: req.user.email,
        event: 'unauthorized_access_attempt',
        severity: 'warning',
        details: {
          attempted_route: req.originalUrl,
          method: req.method,
          user_role: req.user.role,
          required_roles: allowedRoles,
        },
        ipAddress: req.ip,
        requestId: req.requestId,
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware: Check loan amount authority limits.
 * Ensures user cannot approve loans above their role's authority limit.
 */
function checkAuthorityLimit(req, res, next) {
  const { authorityLimits } = require('../config/auth');
  const userRole = req.user.role;
  const amount = parseFloat(req.body.approved_amount || req.body.requested_amount || 0);
  const limit = authorityLimits[userRole];

  if (limit !== undefined && amount > limit) {
    return res.status(403).json({
      error: `Amount $${amount.toLocaleString()} exceeds your authority limit of $${limit.toLocaleString()}`,
    });
  }
  next();
}

module.exports = { authenticate, authorize, checkAuthorityLimit };
