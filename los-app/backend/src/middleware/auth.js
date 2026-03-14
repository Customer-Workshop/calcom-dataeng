const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { db } = require('../config/database');

/**
 * Middleware: Verify JWT token and attach user to request
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware: Require specific roles for access
 * @param  {...string} allowedRoles - Role names that can access the route
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware: Check loan amount authority limits
 * Ensures user cannot approve loans above their role's authority limit
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
