/**
 * Performance indexes migration for 5000+ user scalability.
 *
 * Adds indexes on columns frequently used in WHERE, JOIN, and ORDER BY
 * clauses that are not already indexed in the original schema.
 *
 * Already indexed (from original migration):
 *   - applications: status, branch_id, loan_officer_id
 *   - audit_logs: (entity_type, entity_id), user_id, action
 *
 * New indexes added here target the query patterns in:
 *   - Application detail (fetches by borrower_id, underwriter_id)
 *   - Reporting dashboard (aggregates by state, created_at)
 *   - Conditions / documents / credit reports (lookup by application_id)
 *   - Audit log timeline queries (created_at)
 *
 * Usage:
 *   node src/migrations/addPerformanceIndexes.js
 */

require('dotenv').config();
const { db } = require('../config/database');

async function addPerformanceIndexes() {
  console.log('Adding performance indexes...');

  const indexes = [
    // Applications — additional query patterns
    { table: 'applications', column: 'borrower_id', name: 'idx_applications_borrower_id' },
    { table: 'applications', column: 'underwriter_id', name: 'idx_applications_underwriter_id' },
    { table: 'applications', column: 'state', name: 'idx_applications_state' },
    { table: 'applications', column: 'created_at', name: 'idx_applications_created_at' },
    { table: 'applications', column: 'submitted_at', name: 'idx_applications_submitted_at' },
    { table: 'applications', column: 'funded_at', name: 'idx_applications_funded_at' },
    { table: 'applications', column: 'decision', name: 'idx_applications_decision' },

    // Conditions — queried per application, filtered by status
    { table: 'conditions', column: 'application_id', name: 'idx_conditions_application_id' },
    { table: 'conditions', column: 'status', name: 'idx_conditions_status' },
    { table: 'conditions', column: 'assigned_to', name: 'idx_conditions_assigned_to' },

    // Documents — queried per application
    { table: 'documents', column: 'application_id', name: 'idx_documents_application_id' },
    { table: 'documents', column: 'borrower_id', name: 'idx_documents_borrower_id' },

    // Credit reports — queried per application, ordered by created_at
    { table: 'credit_reports', column: 'application_id', name: 'idx_credit_reports_application_id' },
    { table: 'credit_reports', column: 'borrower_id', name: 'idx_credit_reports_borrower_id' },

    // Decisions — queried per application
    { table: 'decisions', column: 'application_id', name: 'idx_decisions_application_id' },

    // Collateral — queried per application
    { table: 'collateral', column: 'application_id', name: 'idx_collateral_application_id' },

    // Borrowers — lookup by user_id
    { table: 'borrowers', column: 'user_id', name: 'idx_borrowers_user_id' },

    // Users — lookup by role and branch for assignment queries
    { table: 'users', column: 'role_id', name: 'idx_users_role_id' },
    { table: 'users', column: 'branch_id', name: 'idx_users_branch_id' },
    { table: 'users', column: 'is_active', name: 'idx_users_is_active' },

    // Loans — queried by application
    { table: 'loans', column: 'application_id', name: 'idx_loans_application_id' },
    { table: 'loans', column: 'borrower_id', name: 'idx_loans_borrower_id' },

    // Audit logs — timeline queries
    { table: 'audit_logs', column: 'created_at', name: 'idx_audit_logs_created_at' },

    // E-signatures — queried per application
    { table: 'e_signatures', column: 'application_id', name: 'idx_esignatures_application_id' },

    // Notifications — queried per user and application
    { table: 'notifications', column: 'user_id', name: 'idx_notifications_user_id' },
    { table: 'notifications', column: 'application_id', name: 'idx_notifications_application_id' },

    // Funding instructions — queried per application and loan
    { table: 'funding_instructions', column: 'application_id', name: 'idx_funding_application_id' },
    { table: 'funding_instructions', column: 'loan_id', name: 'idx_funding_loan_id' },
  ];

  for (const idx of indexes) {
    try {
      const exists = await db.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = ? AND indexname = ?
      `, [idx.table, idx.name]);

      if (exists.rows.length === 0) {
        await db.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${idx.name} ON ${idx.table} (${idx.column})`);
        console.log(`  Created index: ${idx.name} on ${idx.table}(${idx.column})`);
      } else {
        console.log(`  Index already exists: ${idx.name}`);
      }
    } catch (err) {
      // CREATE INDEX CONCURRENTLY cannot run inside a transaction, so errors are expected
      // if the index already exists or if there's a naming conflict
      if (err.message.includes('already exists')) {
        console.log(`  Index already exists: ${idx.name}`);
      } else {
        console.warn(`  Warning creating ${idx.name}: ${err.message}`);
      }
    }
  }

  // Composite indexes for common multi-column query patterns
  const compositeIndexes = [
    {
      name: 'idx_applications_status_branch',
      table: 'applications',
      columns: 'status, branch_id',
    },
    {
      name: 'idx_applications_status_officer',
      table: 'applications',
      columns: 'status, loan_officer_id',
    },
    {
      name: 'idx_conditions_app_status',
      table: 'conditions',
      columns: 'application_id, status',
    },
    {
      name: 'idx_audit_logs_entity_created',
      table: 'audit_logs',
      columns: 'entity_type, entity_id, created_at',
    },
  ];

  for (const idx of compositeIndexes) {
    try {
      const exists = await db.raw(`
        SELECT 1 FROM pg_indexes 
        WHERE tablename = ? AND indexname = ?
      `, [idx.table, idx.name]);

      if (exists.rows.length === 0) {
        await db.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${idx.name} ON ${idx.table} (${idx.columns})`);
        console.log(`  Created composite index: ${idx.name} on ${idx.table}(${idx.columns})`);
      } else {
        console.log(`  Composite index already exists: ${idx.name}`);
      }
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`  Composite index already exists: ${idx.name}`);
      } else {
        console.warn(`  Warning creating ${idx.name}: ${err.message}`);
      }
    }
  }

  console.log('Performance indexes migration complete.');
}

if (require.main === module) {
  addPerformanceIndexes()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Index migration failed:', err);
      process.exit(1);
    });
}

module.exports = { addPerformanceIndexes };
