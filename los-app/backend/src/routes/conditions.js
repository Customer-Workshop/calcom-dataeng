const express = require('express');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { createAuditLog } = require('../utils/audit');

const router = express.Router();

/** GET /api/conditions/:applicationId - List conditions for an application */
router.get('/:applicationId', authenticate, async (req, res) => {
  try {
    const conditions = await db('conditions')
      .leftJoin('users as assignee', 'conditions.assigned_to', 'assignee.id')
      .leftJoin('users as creator', 'conditions.created_by', 'creator.id')
      .leftJoin('users as clearer', 'conditions.cleared_by', 'clearer.id')
      .where('conditions.application_id', req.params.applicationId)
      .select('conditions.*',
        'assignee.first_name as assignee_first_name', 'assignee.last_name as assignee_last_name',
        'creator.first_name as creator_first_name', 'creator.last_name as creator_last_name',
        'clearer.first_name as clearer_first_name', 'clearer.last_name as clearer_last_name');
    res.json(conditions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conditions' });
  }
});

/** POST /api/conditions/:applicationId - Create a new condition */
router.post('/:applicationId', authenticate, authorize('underwriter', 'branch_manager', 'loan_officer', 'system_admin'),
  validateBody(schemas.condition), async (req, res) => {
  try {
    const [condition] = await db('conditions').insert({
      application_id: parseInt(req.params.applicationId),
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      status: 'pending',
      assigned_to: req.body.assigned_to || null,
      created_by: req.user.id,
      due_date: req.body.due_date || null,
    }).returning('*');

    await createAuditLog({
      userId: req.user.id,
      action: 'condition_created',
      entityType: 'condition',
      entityId: condition.id,
      details: { applicationId: req.params.applicationId, name: req.body.name, category: req.body.category },
    });

    res.status(201).json(condition);
  } catch (error) {
    console.error('Create condition error:', error);
    res.status(500).json({ error: 'Failed to create condition' });
  }
});

/** PUT /api/conditions/clear/:id - Clear a condition */
router.put('/clear/:id', authenticate, authorize('underwriter', 'branch_manager', 'loan_officer', 'system_admin'), async (req, res) => {
  try {
    const [condition] = await db('conditions').where('id', req.params.id).update({
      status: 'cleared',
      cleared_by: req.user.id,
      cleared_at: new Date(),
      notes: req.body.notes || null,
    }).returning('*');

    if (!condition) return res.status(404).json({ error: 'Condition not found' });

    // Check if all conditions are now cleared for the application
    const pendingConditions = await db('conditions')
      .where({ application_id: condition.application_id })
      .whereNotIn('status', ['cleared', 'waived'])
      .count('id as count')
      .first();

    let allCleared = parseInt(pendingConditions.count) === 0;

    // If all conditions cleared, update application status
    if (allCleared) {
      await db('applications').where('id', condition.application_id).update({ status: 'approved' });
    }

    await createAuditLog({
      userId: req.user.id,
      action: 'condition_cleared',
      entityType: 'condition',
      entityId: parseInt(req.params.id),
      details: { applicationId: condition.application_id, allConditionsCleared: allCleared },
    });

    res.json({ condition, all_conditions_cleared: allCleared });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear condition' });
  }
});

/** PUT /api/conditions/waive/:id - Waive a condition */
router.put('/waive/:id', authenticate, authorize('underwriter', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const [condition] = await db('conditions').where('id', req.params.id).update({
      status: 'waived',
      cleared_by: req.user.id,
      cleared_at: new Date(),
      notes: req.body.notes || 'Waived',
    }).returning('*');

    if (!condition) return res.status(404).json({ error: 'Condition not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'condition_waived',
      entityType: 'condition',
      entityId: parseInt(req.params.id),
      details: { applicationId: condition.application_id, is_override: true },
    });

    res.json(condition);
  } catch (error) {
    res.status(500).json({ error: 'Failed to waive condition' });
  }
});

module.exports = router;
