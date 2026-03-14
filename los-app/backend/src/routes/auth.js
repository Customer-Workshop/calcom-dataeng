const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { jwtSecret, jwtExpiry, refreshTokenExpiry, saltRounds } = require('../config/auth');
const { authenticate } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { createAuditLog } = require('../utils/audit');
const { blacklistToken } = require('../utils/tokenBlacklist');
const { generateSecureToken } = require('../utils/encryption');
const {
  checkAccountLockout,
  recordFailedLogin,
  resetFailedLogins,
  validatePasswordPolicy,
  logSecurityEvent,
} = require('../middleware/security');

const router = express.Router();

/** POST /api/auth/register - Register a new borrower user */
router.post('/register', validateBody(schemas.register), async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    // Enforce enterprise password policy
    const policyCheck = validatePasswordPolicy(password);
    if (!policyCheck.valid) {
      return res.status(400).json({ error: 'Password does not meet policy requirements', details: policyCheck.errors });
    }

    const existing = await db('users').where('email', email).first();
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await bcrypt.hash(password, saltRounds);
    const borrowerRole = await db('roles').where('name', 'borrower').first();

    const [user] = await db('users').insert({
      email,
      password_hash,
      first_name,
      last_name,
      phone,
      role_id: borrowerRole.id,
      password_changed_at: new Date(),
    }).returning(['id', 'email', 'first_name', 'last_name', 'role_id']);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'borrower', role_id: borrowerRole.id },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    // Generate refresh token
    const refreshToken = generateSecureToken(48);

    await createAuditLog({
      userId: user.id,
      userEmail: email,
      action: 'user_registered',
      entityType: 'user',
      entityId: user.id,
      details: { role: 'borrower' },
      ipAddress: req.ip,
    });

    res.status(201).json({
      user: { id: user.id, email, first_name, last_name, role: 'borrower' },
      token,
      refreshToken,
      expiresIn: jwtExpiry,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/** POST /api/auth/login - Authenticate user and return JWT */
router.post('/login', validateBody(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check account lockout before attempting authentication
    const lockout = await checkAccountLockout(email);
    if (lockout.locked) {
      return res.status(423).json({
        error: `Account is temporarily locked. Try again in ${lockout.remainingMinutes} minutes.`,
        lockedUntil: lockout.remainingMinutes,
      });
    }

    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.email', email)
      .select('users.*', 'roles.name as role_name', 'roles.authority_limit')
      .first();

    if (!user) {
      // Log failed attempt even for non-existent users (don't reveal user existence)
      await logSecurityEvent({
        event: 'login_failed_unknown_user',
        severity: 'info',
        details: { email_attempted: email },
        ipAddress: req.ip,
        requestId: req.requestId,
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await recordFailedLogin(email, req.ip);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled. Contact your administrator.' });
    }

    // Reset failed login counter on successful authentication
    await resetFailedLogins(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
        branch_id: user.branch_id,
        authority_limit: parseFloat(user.authority_limit || 0),
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    // Generate refresh token for session renewal
    const refreshToken = generateSecureToken(48);

    await createAuditLog({
      userId: user.id,
      userEmail: email,
      action: 'login_success',
      entityType: 'user',
      entityId: user.id,
      details: { ip: req.ip },
      ipAddress: req.ip,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role_name,
        branch_id: user.branch_id,
        authority_limit: parseFloat(user.authority_limit || 0),
      },
      token,
      refreshToken,
      expiresIn: jwtExpiry,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/** POST /api/auth/logout - Revoke current token */
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Decode the token to get its expiration time
    const decoded = jwt.decode(req.token);
    const expiresAt = decoded ? decoded.exp : Math.floor(Date.now() / 1000) + 3600;

    // Blacklist the token so it cannot be reused
    blacklistToken(req.token, expiresAt);

    await createAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'logout',
      entityType: 'user',
      entityId: req.user.id,
      details: { ip: req.ip },
      ipAddress: req.ip,
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

/** POST /api/auth/refresh - Refresh JWT using refresh token */
router.post('/refresh', authenticate, async (req, res) => {
  try {
    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.id', req.user.id)
      .select('users.*', 'roles.name as role_name', 'roles.authority_limit')
      .first();

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or disabled' });
    }

    // Issue new access token
    const newToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role_name,
        role_id: user.role_id,
        branch_id: user.branch_id,
        authority_limit: parseFloat(user.authority_limit || 0),
      },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    // Blacklist old token
    const decoded = jwt.decode(req.token);
    if (decoded) {
      blacklistToken(req.token, decoded.exp);
    }

    res.json({ token: newToken, expiresIn: jwtExpiry });
  } catch (error) {
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/** POST /api/auth/change-password - Change password (authenticated) */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Enforce enterprise password policy on new password
    const policyCheck = validatePasswordPolicy(new_password);
    if (!policyCheck.valid) {
      return res.status(400).json({ error: 'New password does not meet policy requirements', details: policyCheck.errors });
    }

    const user = await db('users').where('id', req.user.id).first();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const validCurrent = await bcrypt.compare(current_password, user.password_hash);
    if (!validCurrent) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Ensure new password is different from current
    const sameAsOld = await bcrypt.compare(new_password, user.password_hash);
    if (sameAsOld) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const password_hash = await bcrypt.hash(new_password, saltRounds);
    await db('users').where('id', req.user.id).update({
      password_hash,
      password_changed_at: new Date(),
    });

    await createAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'password_changed',
      entityType: 'user',
      entityId: req.user.id,
      details: { ip: req.ip },
      ipAddress: req.ip,
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Password change failed' });
  }
});

/** GET /api/auth/me - Get current user info */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .leftJoin('branches', 'users.branch_id', 'branches.id')
      .where('users.id', req.user.id)
      .select(
        'users.id', 'users.email', 'users.first_name', 'users.last_name',
        'users.phone', 'users.branch_id', 'users.is_active',
        'roles.name as role', 'roles.display_name as role_display',
        'roles.authority_limit', 'branches.name as branch_name'
      )
      .first();

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
