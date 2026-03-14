const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { createAuditLog } = require('../utils/audit');
const { saltRounds } = require('../config/auth');

const router = express.Router();

/** GET /api/admin/users - List all users (admin) */
router.get('/users', authenticate, authorize('system_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, role, branch_id, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .leftJoin('branches', 'users.branch_id', 'branches.id');

    if (role) query = query.where('roles.name', role);
    if (branch_id) query = query.where('users.branch_id', parseInt(branch_id));
    if (search) {
      query = query.where(function () {
        this.where('users.email', 'ilike', `%${search}%`)
          .orWhere('users.first_name', 'ilike', `%${search}%`)
          .orWhere('users.last_name', 'ilike', `%${search}%`);
      });
    }

    const countResult = await query.clone().count('users.id as count').first();
    const users = await query
      .select(
        'users.id', 'users.email', 'users.first_name', 'users.last_name',
        'users.phone', 'users.is_active', 'users.last_login', 'users.created_at',
        'roles.name as role', 'roles.display_name as role_display',
        'branches.name as branch_name', 'users.branch_id'
      )
      .orderBy('users.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    res.json({ data: users, total: parseInt(countResult.count), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/** POST /api/admin/users - Create a new user (admin) */
router.post('/users', authenticate, authorize('system_admin'), validateBody(schemas.createUser), async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role_id, branch_id } = req.body;

    const existing = await db('users').where('email', email).first();
    if (existing) return res.status(409).json({ error: 'Email already exists' });

    const password_hash = await bcrypt.hash(password, saltRounds);
    const [user] = await db('users').insert({
      email, password_hash, first_name, last_name, phone, role_id, branch_id,
    }).returning(['id', 'email', 'first_name', 'last_name', 'role_id', 'branch_id']);

    await createAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'user_created',
      entityType: 'user',
      entityId: user.id,
      details: { email, role_id, branch_id },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/** PUT /api/admin/users/:id - Update user (admin) */
router.put('/users/:id', authenticate, authorize('system_admin'), async (req, res) => {
  try {
    const allowed = ['first_name', 'last_name', 'phone', 'role_id', 'branch_id', 'is_active'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (req.body.password) {
      updates.password_hash = await bcrypt.hash(req.body.password, saltRounds);
    }

    const [user] = await db('users').where('id', req.params.id).update(updates).returning('*');
    if (!user) return res.status(404).json({ error: 'User not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'user_updated',
      entityType: 'user',
      entityId: parseInt(req.params.id),
      details: updates,
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/** GET /api/admin/roles - List all roles */
router.get('/roles', authenticate, authorize('system_admin'), async (req, res) => {
  try {
    const roles = await db('roles').orderBy('id');
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

/** GET /api/admin/branches - List all branches */
router.get('/branches', authenticate, async (req, res) => {
  try {
    const branches = await db('branches').orderBy('name');
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

/** POST /api/admin/branches - Create branch (admin) */
router.post('/branches', authenticate, authorize('system_admin'), async (req, res) => {
  try {
    const [branch] = await db('branches').insert(req.body).returning('*');
    await createAuditLog({
      userId: req.user.id,
      action: 'branch_created',
      entityType: 'branch',
      entityId: branch.id,
      details: req.body,
    });
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

/** GET /api/admin/loan-products - List loan products */
router.get('/loan-products', authenticate, async (req, res) => {
  try {
    const products = await db('loan_products').orderBy('name');
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch loan products' });
  }
});

/** PUT /api/admin/loan-products/:id - Update loan product */
router.put('/loan-products/:id', authenticate, authorize('system_admin'), async (req, res) => {
  try {
    const [product] = await db('loan_products').where('id', req.params.id).update(req.body).returning('*');
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'loan_product_updated',
      entityType: 'loan_product',
      entityId: parseInt(req.params.id),
      details: req.body,
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

/** GET /api/admin/state-rules - List state rules */
router.get('/state-rules', authenticate, async (req, res) => {
  try {
    const rules = await db('state_rules').orderBy('state');
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch state rules' });
  }
});

/** PUT /api/admin/state-rules/:id - Update state rules (compliance officer or admin) */
router.put('/state-rules/:id', authenticate, authorize('compliance_officer', 'system_admin'), async (req, res) => {
  try {
    const before = await db('state_rules').where('id', req.params.id).first();
    const [rule] = await db('state_rules').where('id', req.params.id).update({
      ...req.body,
      updated_by: req.user.id,
      updated_at: new Date(),
    }).returning('*');

    if (!rule) return res.status(404).json({ error: 'State rule not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'state_rule_updated',
      entityType: 'state_rule',
      entityId: parseInt(req.params.id),
      details: { before, after: rule },
    });

    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update state rule' });
  }
});

/** POST /api/admin/state-rules - Create state rule */
router.post('/state-rules', authenticate, authorize('compliance_officer', 'system_admin'), async (req, res) => {
  try {
    const [rule] = await db('state_rules').insert({
      ...req.body,
      updated_by: req.user.id,
    }).returning('*');

    await createAuditLog({
      userId: req.user.id,
      action: 'state_rule_created',
      entityType: 'state_rule',
      entityId: rule.id,
      details: req.body,
    });

    res.status(201).json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create state rule' });
  }
});

/** GET /api/admin/audit-logs - Get audit trail */
router.get('/audit-logs', authenticate, authorize('compliance_officer', 'system_admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50, entity_type, action, user_id } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('audit_logs').leftJoin('users', 'audit_logs.user_id', 'users.id');
    if (entity_type) query = query.where('audit_logs.entity_type', entity_type);
    if (action) query = query.where('audit_logs.action', 'ilike', `%${action}%`);
    if (user_id) query = query.where('audit_logs.user_id', parseInt(user_id));

    const countResult = await query.clone().count('audit_logs.id as count').first();
    const logs = await query
      .select('audit_logs.*', 'users.first_name', 'users.last_name', 'users.email')
      .orderBy('audit_logs.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    res.json({ data: logs, total: parseInt(countResult.count), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
