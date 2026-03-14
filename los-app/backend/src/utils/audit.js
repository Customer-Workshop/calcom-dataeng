const { db } = require('../config/database');

/**
 * Create an audit log entry for every significant action in the system.
 * Every action, override, document event, rule change is timestamped and user-attributed.
 */
async function createAuditLog({ userId, userEmail, action, entityType, entityId, details, ipAddress }) {
  try {
    await db('audit_logs').insert({
      user_id: userId,
      user_email: userEmail,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      ip_address: ipAddress,
    });
  } catch (error) {
    console.error('Audit log creation failed:', error.message);
  }
}

module.exports = { createAuditLog };
