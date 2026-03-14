const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { jwtSecret, jwtExpiry, saltRounds } = require('../config/auth');
const { authenticate } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { createAuditLog } = require('../utils/audit');

const router = express.Router();

/** POST /api/auth/register - Register a new borrower user */
router.post('/register', validateBody(schemas.register), async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

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
    }).returning(['id', 'email', 'first_name', 'last_name', 'role_id']);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'borrower', role_id: borrowerRole.id },
      jwtSecret,
      { expiresIn: jwtExpiry }
    );

    await createAuditLog({
      userId: user.id,
      userEmail: email,
      action: 'user_registered',
      entityType: 'user',
      entityId: user.id,
      details: { role: 'borrower' },
    });

    res.status(201).json({ user: { id: user.id, email, first_name, last_name, role: 'borrower' }, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/** POST /api/auth/login - Authenticate user and return JWT */
router.post('/login', validateBody(schemas.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.email', email)
      .select('users.*', 'roles.name as role_name', 'roles.authority_limit')
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    await db('users').where('id', user.id).update({ last_login: new Date() });

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
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
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
