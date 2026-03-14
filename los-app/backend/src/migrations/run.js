require('dotenv').config();
const { db } = require('../config/database');

async function runMigrations() {
  console.log('Running database migrations...');
  
  try {
    // Create tables in order of dependencies
    
    // 1. Branches
    await db.schema.createTableIfNotExists('branches', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('code').unique().notNullable();
      table.string('address');
      table.string('city');
      table.string('state', 2);
      table.string('zip', 10);
      table.string('phone');
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    });

    // 2. Roles
    await db.schema.createTableIfNotExists('roles', (table) => {
      table.increments('id').primary();
      table.string('name').unique().notNullable();
      table.string('display_name').notNullable();
      table.text('description');
      table.decimal('authority_limit', 12, 2).defaultTo(0);
      table.timestamps(true, true);
    });

    // 3. Users (with enterprise security columns)
    await db.schema.createTableIfNotExists('users', (table) => {
      table.increments('id').primary();
      table.string('email').unique().notNullable();
      table.string('password_hash').notNullable();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('phone');
      table.integer('role_id').unsigned().references('id').inTable('roles');
      table.integer('branch_id').unsigned().references('id').inTable('branches');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_login');
      // Security columns for account lockout and password policy
      table.integer('failed_login_attempts').defaultTo(0);
      table.timestamp('locked_until');
      table.timestamp('password_changed_at');
      table.timestamps(true, true);
    });

    // 4. Loan Products
    await db.schema.createTableIfNotExists('loan_products', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('code').unique().notNullable();
      table.text('description');
      table.string('type').notNullable(); // personal_secured, auto_secured, home_improvement
      table.decimal('min_amount', 12, 2).notNullable();
      table.decimal('max_amount', 12, 2).notNullable();
      table.decimal('min_rate', 5, 3).notNullable();
      table.decimal('max_rate', 5, 3).notNullable();
      table.integer('min_term_months').notNullable();
      table.integer('max_term_months').notNullable();
      table.decimal('max_ltv', 5, 2).defaultTo(100);
      table.integer('min_credit_score').defaultTo(580);
      table.boolean('is_active').defaultTo(true);
      table.boolean('requires_collateral').defaultTo(true);
      table.boolean('right_of_rescission').defaultTo(false);
      table.timestamps(true, true);
    });

    // 5. Borrowers (PII fields encrypted at application layer via AES-256-GCM)
    await db.schema.createTableIfNotExists('borrowers', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.text('ssn_last_four'); // Encrypted (AES-256-GCM)
      table.string('ssn_hash'); // HMAC-SHA256 for lookup without decryption
      table.text('date_of_birth'); // Encrypted (AES-256-GCM)
      table.string('address_street');
      table.string('address_city');
      table.string('address_state', 2);
      table.string('address_zip', 10);
      table.string('employer_name');
      table.string('employment_status'); // employed, self_employed, retired, unemployed
      table.text('annual_income'); // Encrypted (AES-256-GCM)
      table.text('monthly_debt_payments'); // Encrypted (AES-256-GCM)
      table.string('income_source'); // salary, sso, pension, business, other
      table.integer('years_employed').defaultTo(0);
      table.timestamps(true, true);
    });

    // 6. Applications
    await db.schema.createTableIfNotExists('applications', (table) => {
      table.increments('id').primary();
      table.string('application_number').unique().notNullable();
      table.integer('borrower_id').unsigned().references('id').inTable('borrowers');
      table.integer('co_borrower_id').unsigned().references('id').inTable('borrowers');
      table.integer('loan_product_id').unsigned().references('id').inTable('loan_products');
      table.integer('loan_officer_id').unsigned().references('id').inTable('users');
      table.integer('underwriter_id').unsigned().references('id').inTable('users');
      table.integer('branch_id').unsigned().references('id').inTable('branches');
      table.decimal('requested_amount', 12, 2).notNullable();
      table.decimal('approved_amount', 12, 2);
      table.decimal('interest_rate', 5, 3);
      table.integer('term_months');
      table.string('purpose');
      table.string('status').defaultTo('draft');
      // Status: draft, submitted, pre_qualified, credit_pulled, identity_verified,
      // income_verified, underwriting, approved, conditionally_approved,
      // counter_offered, declined, docs_sent, e_signed, funding_authorized,
      // funded, servicing, withdrawn
      table.string('decision'); // auto_approve, refer, auto_decline, counter_offer
      table.text('decision_reasons'); // JSON array of reason codes
      table.text('adverse_action_notice'); // Generated notice text
      table.decimal('dti_ratio', 5, 2);
      table.decimal('ltv_ratio', 5, 2);
      table.string('state', 2);
      table.timestamp('submitted_at');
      table.timestamp('decision_at');
      table.timestamp('funded_at');
      table.timestamps(true, true);
      
      // Indexes for performance
      table.index('status');
      table.index('branch_id');
      table.index('loan_officer_id');
    });

    // 7. Collateral
    await db.schema.createTableIfNotExists('collateral', (table) => {
      table.increments('id').primary();
      table.integer('application_id').unsigned().references('id').inTable('applications').onDelete('CASCADE');
      table.string('type').notNullable(); // vehicle, property, equipment
      table.string('vin', 17);
      table.integer('year');
      table.string('make');
      table.string('model');
      table.string('trim');
      table.integer('mileage');
      table.string('condition'); // excellent, good, fair, poor
      table.text('condition_notes');
      table.decimal('estimated_value', 12, 2);
      table.decimal('nada_value', 12, 2);
      table.decimal('kbb_value', 12, 2);
      table.string('valuation_source'); // nada, kbb, manual
      table.text('photo_urls'); // JSON array
      table.string('property_address');
      table.timestamps(true, true);
    });

    // 8. Valuations
    await db.schema.createTableIfNotExists('valuations', (table) => {
      table.increments('id').primary();
      table.integer('collateral_id').unsigned().references('id').inTable('collateral').onDelete('CASCADE');
      table.string('source').notNullable(); // nada, kbb, appraisal
      table.decimal('value', 12, 2).notNullable();
      table.date('valuation_date');
      table.text('details'); // JSON
      table.timestamps(true, true);
    });

    // 9. Credit Reports
    await db.schema.createTableIfNotExists('credit_reports', (table) => {
      table.increments('id').primary();
      table.integer('application_id').unsigned().references('id').inTable('applications').onDelete('CASCADE');
      table.integer('borrower_id').unsigned().references('id').inTable('borrowers');
      table.string('pull_type').notNullable(); // soft, hard
      table.string('bureau'); // experian, equifax, transunion
      table.integer('score');
      table.text('tradelines'); // JSON array
      table.text('inquiries'); // JSON array
      table.text('public_records'); // JSON array
      table.text('raw_response'); // JSON full mock response
      table.timestamp('pulled_at').defaultTo(db.fn.now());
      table.timestamps(true, true);
    });

    // 10. Decisions
    await db.schema.createTableIfNotExists('decisions', (table) => {
      table.increments('id').primary();
      table.integer('application_id').unsigned().references('id').inTable('applications').onDelete('CASCADE');
      table.integer('decided_by').unsigned().references('id').inTable('users');
      table.string('decision_type').notNullable(); // auto_approve, auto_decline, manual_approve, manual_decline, counter_offer, refer
      table.text('reason_codes'); // JSON array
      table.text('conditions'); // JSON array of conditions required
      table.decimal('approved_amount', 12, 2);
      table.decimal('approved_rate', 5, 3);
      table.integer('approved_term');
      table.text('notes');
      table.boolean('is_override').defaultTo(false);
      table.timestamps(true, true);
    });

    // 11. Conditions
    await db.schema.createTableIfNotExists('conditions', (table) => {
      table.increments('id').primary();
      table.integer('application_id').unsigned().references('id').inTable('applications').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('description');
      table.string('category'); // prior_to_approval, prior_to_funding, prior_to_closing
      table.string('status').defaultTo('pending'); // pending, submitted, reviewed, cleared, waived
      table.integer('assigned_to').unsigned().references('id').inTable('users');
      table.integer('created_by').unsigned().references('id').inTable('users');
      table.integer('cleared_by').unsigned().references('id').inTable('users');
      table.timestamp('due_date');
      table.timestamp('cleared_at');
      table.text('notes');
      table.timestamps(true, true);
    });

    // 12. Documents
    await db.schema.createTableIfNotExists('documents', (table) => {
      table.increments('id').primary();
      table.integer('application_id').unsigned().references('id').inTable('applications').onDelete('CASCADE');
      table.integer('borrower_id').unsigned().references('id').inTable('borrowers');
      table.integer('condition_id').unsigned().references('id').inTable('conditions');
      table.string('name').notNullable();
      table.string('category'); // income, identity, collateral, insurance, agreement, adverse_action, disclosure
      table.string('file_path');
      table.string('file_type');
      table.integer('file_size');
      table.integer('uploaded_by').unsigned().references('id').inTable('users');
      table.string('status').defaultTo('uploaded'); // uploaded, reviewed, accepted, rejected
      table.text('notes');
      table.timestamps(true, true);
    });

    // 13. Loans (funded/serviced)
    await db.schema.createTableIfNotExists('loans', (table) => {
      table.increments('id').primary();
      table.string('loan_number').unique().notNullable();
      table.integer('application_id').unsigned().references('id').inTable('applications');
      table.integer('borrower_id').unsigned().references('id').inTable('borrowers');
      table.decimal('principal_amount', 12, 2).notNullable();
      table.decimal('interest_rate', 5, 3).notNullable();
      table.integer('term_months').notNullable();
      table.decimal('monthly_payment', 12, 2);
      table.decimal('total_of_payments', 12, 2);
      table.decimal('finance_charge', 12, 2);
      table.decimal('apr', 5, 3);
      table.date('first_payment_date');
      table.date('maturity_date');
      table.string('status').defaultTo('active'); // active, paid_off, charged_off, in_servicing
      table.text('servicing_data'); // JSON export
      table.timestamps(true, true);
    });

    // 14. Funding Instructions
    await db.schema.createTableIfNotExists('funding_instructions', (table) => {
      table.increments('id').primary();
      table.integer('loan_id').unsigned().references('id').inTable('loans');
      table.integer('application_id').unsigned().references('id').inTable('applications');
      table.string('disbursement_method').defaultTo('ach'); // ach, wire, check
      table.string('account_number');
      table.string('routing_number');
      table.string('account_holder_name');
      table.decimal('amount', 12, 2);
      table.string('status').defaultTo('pending'); // pending, authorized, sent, completed, failed
      table.integer('authorized_by').unsigned().references('id').inTable('users');
      table.timestamp('authorized_at');
      table.timestamp('sent_at');
      table.text('notes');
      table.timestamps(true, true);
    });

    // 15. State Rules
    await db.schema.createTableIfNotExists('state_rules', (table) => {
      table.increments('id').primary();
      table.string('state', 2).notNullable();
      table.string('state_name').notNullable();
      table.boolean('is_enabled').defaultTo(true);
      table.decimal('max_rate_cap', 5, 3);
      table.decimal('max_fee_percentage', 5, 2);
      table.decimal('max_fee_flat', 12, 2);
      table.decimal('min_loan_amount', 12, 2);
      table.decimal('max_loan_amount', 12, 2);
      table.text('disclosure_language');
      table.text('additional_rules'); // JSONB for flexible rule storage
      table.boolean('right_of_rescission').defaultTo(false);
      table.integer('rescission_days').defaultTo(3);
      table.integer('updated_by').unsigned().references('id').inTable('users');
      table.timestamps(true, true);
      table.unique('state');
    });

    // 16. Audit Logs
    await db.schema.createTableIfNotExists('audit_logs', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.string('user_email');
      table.string('action').notNullable();
      table.string('entity_type'); // application, collateral, document, condition, decision, user, state_rule, loan
      table.integer('entity_id');
      table.text('details'); // JSON with before/after values
      table.string('ip_address');
      table.timestamp('created_at').defaultTo(db.fn.now());
      table.index(['entity_type', 'entity_id']);
      table.index('user_id');
      table.index('action');
    });

    // 17. E-signatures
    await db.schema.createTableIfNotExists('e_signatures', (table) => {
      table.increments('id').primary();
      table.integer('application_id').unsigned().references('id').inTable('applications');
      table.integer('loan_id').unsigned().references('id').inTable('loans');
      table.integer('borrower_id').unsigned().references('id').inTable('borrowers');
      table.string('document_type'); // loan_agreement, disclosure, adverse_action
      table.text('signature_data'); // base64 encoded signature image
      table.string('signer_name');
      table.string('signer_ip');
      table.timestamp('signed_at');
      table.string('status').defaultTo('pending'); // pending, signed, expired
      table.timestamps(true, true);
    });

    // 18. Notifications
    await db.schema.createTableIfNotExists('notifications', (table) => {
      table.increments('id').primary();
      table.integer('user_id').unsigned().references('id').inTable('users');
      table.integer('application_id').unsigned().references('id').inTable('applications');
      table.string('type').notNullable(); // email, sms
      table.string('template');
      table.string('recipient');
      table.string('subject');
      table.text('body');
      table.string('status').defaultTo('sent'); // sent, delivered, failed
      table.timestamps(true, true);
    });

    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };
