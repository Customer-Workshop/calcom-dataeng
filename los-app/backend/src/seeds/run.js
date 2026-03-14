require('dotenv').config();
const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding database...');

  try {
    // Clear existing data in reverse dependency order
    const tables = [
      'notifications', 'e_signatures', 'audit_logs', 'funding_instructions',
      'loans', 'documents', 'conditions', 'decisions', 'credit_reports',
      'valuations', 'collateral', 'applications', 'borrowers',
      'state_rules', 'loan_products', 'users', 'roles', 'branches'
    ];
    for (const t of tables) {
      await db.raw(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
    }

    // 1. Seed Roles
    const roles = [
      { name: 'borrower', display_name: 'Borrower', description: 'Loan applicant', authority_limit: 0 },
      { name: 'loan_officer', display_name: 'Loan Officer', description: 'Intake and pipeline management', authority_limit: 100000 },
      { name: 'branch_manager', display_name: 'Branch Manager', description: 'Team pipeline and approval authority', authority_limit: 500000 },
      { name: 'underwriter', display_name: 'Underwriter', description: 'Risk assessment and loan decisions', authority_limit: 1000000 },
      { name: 'compliance_officer', display_name: 'Compliance Officer', description: 'Regulatory compliance and audit', authority_limit: 0 },
      { name: 'system_admin', display_name: 'System Administrator', description: 'System configuration and user management', authority_limit: 0 },
      { name: 'executive', display_name: 'Executive', description: 'Reporting and KPI dashboards', authority_limit: 0 },
    ];
    await db('roles').insert(roles);
    console.log('  Roles seeded');

    // 2. Seed Branches
    const branches = [
      { name: 'Downtown Austin', code: 'TX-AUS-001', address: '100 Congress Ave', city: 'Austin', state: 'TX', zip: '78701', phone: '512-555-0100' },
      { name: 'Houston Galleria', code: 'TX-HOU-001', address: '5085 Westheimer Rd', city: 'Houston', state: 'TX', zip: '77056', phone: '713-555-0200' },
      { name: 'Miami Beach', code: 'FL-MIA-001', address: '1100 Lincoln Rd', city: 'Miami Beach', state: 'FL', zip: '33139', phone: '305-555-0300' },
      { name: 'Orlando Downtown', code: 'FL-ORL-001', address: '400 S Orange Ave', city: 'Orlando', state: 'FL', zip: '32801', phone: '407-555-0400' },
      { name: 'Columbus Central', code: 'OH-COL-001', address: '250 Civic Center Dr', city: 'Columbus', state: 'OH', zip: '43215', phone: '614-555-0500' },
    ];
    await db('branches').insert(branches);
    console.log('  Branches seeded');

    // 3. Seed Users
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const users = [
      // Loan Officers (10)
      { email: 'lo1@republicfinance.com', password_hash: passwordHash, first_name: 'Sarah', last_name: 'Johnson', phone: '512-555-1001', role_id: 2, branch_id: 1 },
      { email: 'lo2@republicfinance.com', password_hash: passwordHash, first_name: 'Michael', last_name: 'Chen', phone: '512-555-1002', role_id: 2, branch_id: 1 },
      { email: 'lo3@republicfinance.com', password_hash: passwordHash, first_name: 'Jessica', last_name: 'Williams', phone: '713-555-1003', role_id: 2, branch_id: 2 },
      { email: 'lo4@republicfinance.com', password_hash: passwordHash, first_name: 'David', last_name: 'Brown', phone: '713-555-1004', role_id: 2, branch_id: 2 },
      { email: 'lo5@republicfinance.com', password_hash: passwordHash, first_name: 'Emily', last_name: 'Davis', phone: '305-555-1005', role_id: 2, branch_id: 3 },
      { email: 'lo6@republicfinance.com', password_hash: passwordHash, first_name: 'James', last_name: 'Wilson', phone: '305-555-1006', role_id: 2, branch_id: 3 },
      { email: 'lo7@republicfinance.com', password_hash: passwordHash, first_name: 'Amanda', last_name: 'Taylor', phone: '407-555-1007', role_id: 2, branch_id: 4 },
      { email: 'lo8@republicfinance.com', password_hash: passwordHash, first_name: 'Robert', last_name: 'Martinez', phone: '407-555-1008', role_id: 2, branch_id: 4 },
      { email: 'lo9@republicfinance.com', password_hash: passwordHash, first_name: 'Lisa', last_name: 'Anderson', phone: '614-555-1009', role_id: 2, branch_id: 5 },
      { email: 'lo10@republicfinance.com', password_hash: passwordHash, first_name: 'Christopher', last_name: 'Thomas', phone: '614-555-1010', role_id: 2, branch_id: 5 },
      // Underwriters (3)
      { email: 'uw1@republicfinance.com', password_hash: passwordHash, first_name: 'Patricia', last_name: 'Moore', phone: '512-555-2001', role_id: 4, branch_id: 1 },
      { email: 'uw2@republicfinance.com', password_hash: passwordHash, first_name: 'Daniel', last_name: 'Jackson', phone: '305-555-2002', role_id: 4, branch_id: 3 },
      { email: 'uw3@republicfinance.com', password_hash: passwordHash, first_name: 'Nancy', last_name: 'White', phone: '614-555-2003', role_id: 4, branch_id: 5 },
      // Branch Managers (5)
      { email: 'bm1@republicfinance.com', password_hash: passwordHash, first_name: 'Richard', last_name: 'Harris', phone: '512-555-3001', role_id: 3, branch_id: 1 },
      { email: 'bm2@republicfinance.com', password_hash: passwordHash, first_name: 'Karen', last_name: 'Clark', phone: '713-555-3002', role_id: 3, branch_id: 2 },
      { email: 'bm3@republicfinance.com', password_hash: passwordHash, first_name: 'Thomas', last_name: 'Lewis', phone: '305-555-3003', role_id: 3, branch_id: 3 },
      { email: 'bm4@republicfinance.com', password_hash: passwordHash, first_name: 'Sandra', last_name: 'Robinson', phone: '407-555-3004', role_id: 3, branch_id: 4 },
      { email: 'bm5@republicfinance.com', password_hash: passwordHash, first_name: 'Mark', last_name: 'Walker', phone: '614-555-3005', role_id: 3, branch_id: 5 },
      // Compliance Officer
      { email: 'compliance@republicfinance.com', password_hash: passwordHash, first_name: 'Helen', last_name: 'Young', phone: '512-555-4001', role_id: 5, branch_id: 1 },
      // System Admin
      { email: 'admin@republicfinance.com', password_hash: passwordHash, first_name: 'Marcus', last_name: 'Rivera', phone: '512-555-5001', role_id: 6, branch_id: 1 },
      // Executive
      { email: 'exec@republicfinance.com', password_hash: passwordHash, first_name: 'Victoria', last_name: 'King', phone: '512-555-6001', role_id: 7, branch_id: 1 },
      // Borrower users
      { email: 'borrower1@example.com', password_hash: passwordHash, first_name: 'John', last_name: 'Smith', phone: '512-555-7001', role_id: 1, branch_id: null },
      { email: 'borrower2@example.com', password_hash: passwordHash, first_name: 'Jane', last_name: 'Doe', phone: '713-555-7002', role_id: 1, branch_id: null },
      { email: 'borrower3@example.com', password_hash: passwordHash, first_name: 'Robert', last_name: 'Wilson', phone: '305-555-7003', role_id: 1, branch_id: null },
      { email: 'borrower4@example.com', password_hash: passwordHash, first_name: 'Maria', last_name: 'Garcia', phone: '407-555-7004', role_id: 1, branch_id: null },
      { email: 'borrower5@example.com', password_hash: passwordHash, first_name: 'William', last_name: 'Lee', phone: '614-555-7005', role_id: 1, branch_id: null },
    ];
    await db('users').insert(users);
    console.log('  Users seeded');

    // 4. Seed Loan Products
    const loanProducts = [
      {
        name: 'Personal Loan', code: 'PL-001', description: 'Unsecured personal loan for any purpose — debt consolidation, medical bills, home projects, or major purchases',
        type: 'personal_unsecured', min_amount: 1000, max_amount: 25000, min_rate: 8.99, max_rate: 24.99,
        min_term_months: 6, max_term_months: 60, max_ltv: 0, min_credit_score: 580, requires_collateral: false, right_of_rescission: false,
      },
      {
        name: 'Personal Secured Loan', code: 'PSL-001', description: 'Secured personal loan backed by savings, CD, or titled vehicle',
        type: 'personal_secured', min_amount: 1000, max_amount: 50000, min_rate: 5.99, max_rate: 15.99,
        min_term_months: 12, max_term_months: 60, max_ltv: 90, min_credit_score: 620, requires_collateral: true, right_of_rescission: false,
      },
      {
        name: 'Auto Secured Loan', code: 'ASL-001', description: 'Vehicle-secured auto loan for new and used vehicles',
        type: 'auto_secured', min_amount: 5000, max_amount: 100000, min_rate: 3.99, max_rate: 12.99,
        min_term_months: 24, max_term_months: 84, max_ltv: 120, min_credit_score: 580, requires_collateral: true, right_of_rescission: false,
      },
      {
        name: 'Home Improvement Loan', code: 'HIL-001', description: 'Secured loan for home improvement projects',
        type: 'home_improvement', min_amount: 10000, max_amount: 250000, min_rate: 4.99, max_rate: 11.99,
        min_term_months: 36, max_term_months: 180, max_ltv: 80, min_credit_score: 640, requires_collateral: true, right_of_rescission: true,
      },
    ];
    await db('loan_products').insert(loanProducts);
    console.log('  Loan products seeded');

    // 5. Seed State Rules (TX, FL, OH)
    const stateRules = [
      {
        state: 'TX', state_name: 'Texas', is_enabled: true, max_rate_cap: 18.000, max_fee_percentage: 3.00,
        max_fee_flat: 500, min_loan_amount: 500, max_loan_amount: 500000,
        disclosure_language: 'Texas Finance Code Chapter 342 requires disclosure of all loan terms. Borrowers have the right to receive a copy of all loan documents. Military borrowers are afforded additional protections under the Military Lending Act.',
        additional_rules: JSON.stringify({ military_lending_act: true, prepayment_penalty_allowed: false }),
        right_of_rescission: false, rescission_days: 0,
      },
      {
        state: 'FL', state_name: 'Florida', is_enabled: true, max_rate_cap: 18.000, max_fee_percentage: 2.50,
        max_fee_flat: 400, min_loan_amount: 1000, max_loan_amount: 400000,
        disclosure_language: 'Florida Consumer Finance Act requires clear disclosure of APR, total finance charge, and total of payments. All fees must be disclosed prior to closing.',
        additional_rules: JSON.stringify({ cooling_off_period: true, max_late_fee_pct: 5 }),
        right_of_rescission: true, rescission_days: 3,
      },
      {
        state: 'OH', state_name: 'Ohio', is_enabled: true, max_rate_cap: 25.000, max_fee_percentage: 4.00,
        max_fee_flat: 600, min_loan_amount: 500, max_loan_amount: 300000,
        disclosure_language: 'Ohio Short-Term Loan Act requires transparency in all lending terms. Lenders must provide a written agreement detailing all charges and the total cost of the loan.',
        additional_rules: JSON.stringify({ short_term_restrictions: true, max_monthly_maintenance_fee: 10 }),
        right_of_rescission: false, rescission_days: 0,
      },
    ];
    await db('state_rules').insert(stateRules);
    console.log('  State rules seeded');

    // 6. Seed Borrowers
    const borrowers = [
      { user_id: 22, ssn_last_four: '1234', ssn_hash: 'mock_hash_1', date_of_birth: '1985-03-15', address_street: '123 Main St', address_city: 'Austin', address_state: 'TX', address_zip: '78701', employer_name: 'Tech Corp', employment_status: 'employed', annual_income: 95000, monthly_debt_payments: 1200, income_source: 'salary', years_employed: 5 },
      { user_id: 23, ssn_last_four: '5678', ssn_hash: 'mock_hash_2', date_of_birth: '1990-07-22', address_street: '456 Oak Ave', address_city: 'Houston', address_state: 'TX', address_zip: '77056', employer_name: 'Finance Inc', employment_status: 'employed', annual_income: 72000, monthly_debt_payments: 800, income_source: 'salary', years_employed: 3 },
      { user_id: 24, ssn_last_four: '9012', ssn_hash: 'mock_hash_3', date_of_birth: '1978-11-05', address_street: '789 Palm Dr', address_city: 'Miami Beach', address_state: 'FL', address_zip: '33139', employer_name: 'Retired', employment_status: 'retired', annual_income: 48000, monthly_debt_payments: 400, income_source: 'pension', years_employed: 0 },
      { user_id: 25, ssn_last_four: '3456', ssn_hash: 'mock_hash_4', date_of_birth: '1992-01-30', address_street: '321 Lake Rd', address_city: 'Orlando', address_state: 'FL', address_zip: '32801', employer_name: 'Self', employment_status: 'self_employed', annual_income: 110000, monthly_debt_payments: 2500, income_source: 'business', years_employed: 8 },
      { user_id: 26, ssn_last_four: '7890', ssn_hash: 'mock_hash_5', date_of_birth: '1988-06-18', address_street: '555 Elm St', address_city: 'Columbus', address_state: 'OH', address_zip: '43215', employer_name: 'State of Ohio', employment_status: 'employed', annual_income: 65000, monthly_debt_payments: 600, income_source: 'salary', years_employed: 10 },
    ];
    await db('borrowers').insert(borrowers);
    console.log('  Borrowers seeded');

    // 7. Seed Applications at various stages
    const applications = [
      // App 1: Draft - Personal Loan
      { application_number: 'RF-2026-001', borrower_id: 1, loan_product_id: 1, loan_officer_id: 1, branch_id: 1, requested_amount: 5000, term_months: 24, purpose: 'Medical bills', status: 'draft', state: 'TX' },
      // App 2: Submitted - Personal Secured
      { application_number: 'RF-2026-002', borrower_id: 2, loan_product_id: 2, loan_officer_id: 3, branch_id: 2, requested_amount: 15000, term_months: 36, purpose: 'Debt consolidation', status: 'submitted', state: 'TX', submitted_at: new Date() },
      // App 3: Pre-qualified - Auto Loan
      { application_number: 'RF-2026-003', borrower_id: 3, loan_product_id: 3, loan_officer_id: 5, branch_id: 3, requested_amount: 28500, term_months: 60, purpose: '2024 Toyota Camry purchase', status: 'pre_qualified', state: 'FL', submitted_at: new Date() },
      // App 4: Underwriting - Home Improvement
      { application_number: 'RF-2026-004', borrower_id: 4, loan_product_id: 4, loan_officer_id: 7, underwriter_id: 12, branch_id: 4, requested_amount: 45000, term_months: 120, purpose: 'Kitchen and bathroom renovation', status: 'underwriting', state: 'FL', submitted_at: new Date(), dti_ratio: 27.27, ltv_ratio: 75 },
      // App 5: Approved - Personal Loan (unsecured)
      { application_number: 'RF-2026-005', borrower_id: 5, loan_product_id: 1, loan_officer_id: 9, underwriter_id: 13, branch_id: 5, requested_amount: 8000, approved_amount: 8000, interest_rate: 12.49, term_months: 36, purpose: 'Wedding expenses', status: 'approved', decision: 'auto_approve', state: 'OH', submitted_at: new Date(), decision_at: new Date(), dti_ratio: 11.08, ltv_ratio: 0 },
      // App 6: Conditionally approved - Auto Loan
      { application_number: 'RF-2026-006', borrower_id: 1, loan_product_id: 3, loan_officer_id: 1, underwriter_id: 11, branch_id: 1, requested_amount: 32000, approved_amount: 32000, interest_rate: 6.49, term_months: 60, purpose: '2025 Honda CR-V purchase', status: 'conditionally_approved', decision: 'manual_approve', state: 'TX', submitted_at: new Date(), decision_at: new Date(), dti_ratio: 18.95, ltv_ratio: 85 },
      // App 7: Declined - Personal Loan
      { application_number: 'RF-2026-007', borrower_id: 2, loan_product_id: 1, loan_officer_id: 3, branch_id: 2, requested_amount: 20000, term_months: 48, purpose: 'Vacation travel', status: 'declined', decision: 'auto_decline', decision_reasons: JSON.stringify(['Credit score below minimum', 'DTI ratio exceeds maximum']), adverse_action_notice: 'ADVERSE ACTION NOTICE\n\nRepublic Finance\nDate: ' + new Date().toLocaleDateString() + '\n\nDear Jane Doe,\n\nAfter careful review of your application RF-2026-007, we regret to inform you that your request for credit has been denied.\n\nReasons for denial:\n1. Credit score below minimum threshold (520 vs. required 580)\n2. Debt-to-income ratio exceeds maximum guidelines (45% vs. max 43%)\n\nThis decision was based in whole or in part on information obtained from:\n- TransUnion Credit Bureau\n\nYou have the right to obtain a free copy of your credit report within 60 days.\nYou have the right to dispute any inaccurate information.\n\nEqual Credit Opportunity Act Notice: Federal law prohibits creditors from discriminating against applicants on the basis of race, color, religion, national origin, sex, marital status, or age.\n\nRepublic Finance | NMLS #123456', state: 'TX', submitted_at: new Date(), decision_at: new Date(), dti_ratio: 45, ltv_ratio: 0 },
      // App 8: Counter offered - Personal Secured
      { application_number: 'RF-2026-008', borrower_id: 3, loan_product_id: 2, loan_officer_id: 5, underwriter_id: 12, branch_id: 3, requested_amount: 35000, approved_amount: 22000, interest_rate: 9.99, term_months: 48, purpose: 'Small business equipment', status: 'counter_offered', decision: 'counter_offer', state: 'FL', submitted_at: new Date(), decision_at: new Date(), dti_ratio: 22, ltv_ratio: 70 },
      // App 9: E-signed - Auto Loan
      { application_number: 'RF-2026-009', borrower_id: 4, loan_product_id: 3, loan_officer_id: 7, underwriter_id: 12, branch_id: 4, requested_amount: 42000, approved_amount: 42000, interest_rate: 5.49, term_months: 72, purpose: '2025 Ford Explorer purchase', status: 'e_signed', decision: 'auto_approve', state: 'FL', submitted_at: new Date(), decision_at: new Date(), dti_ratio: 30, ltv_ratio: 78 },
      // App 10: Funded - Personal Loan
      { application_number: 'RF-2026-010', borrower_id: 5, loan_product_id: 1, loan_officer_id: 9, underwriter_id: 13, branch_id: 5, requested_amount: 6500, approved_amount: 6500, interest_rate: 14.99, term_months: 24, purpose: 'Emergency home repair', status: 'funded', decision: 'auto_approve', state: 'OH', submitted_at: new Date(), decision_at: new Date(), funded_at: new Date(), dti_ratio: 9.23, ltv_ratio: 0 },
    ];
    await db('applications').insert(applications);
    console.log('  Applications seeded');

    // 8. Seed Collateral for applicable applications (only for secured products)
    const collateral = [
      // App 3: Auto Loan - 2024 Toyota Camry
      { application_id: 3, type: 'vehicle', vin: '4T1BZ1HK5RU123456', year: 2024, make: 'Toyota', model: 'Camry', trim: 'SE', mileage: 8200, condition: 'excellent', estimated_value: 31000, nada_value: 31500, kbb_value: 30800, valuation_source: 'nada' },
      // App 4: Home Improvement
      { application_id: 4, type: 'property', property_address: '321 Lake Rd, Orlando, FL 32801', estimated_value: 285000, condition: 'good' },
      // App 6: Auto Loan - 2025 Honda CR-V
      { application_id: 6, type: 'vehicle', vin: '2HKRW2H55PH567890', year: 2025, make: 'Honda', model: 'CR-V', trim: 'EX-L', mileage: 1200, condition: 'excellent', estimated_value: 37500, nada_value: 38000, kbb_value: 37200, valuation_source: 'nada' },
      // App 9: Auto Loan - 2025 Ford Explorer
      { application_id: 9, type: 'vehicle', vin: '1FM5K8GC7RGA12345', year: 2025, make: 'Ford', model: 'Explorer', trim: 'XLT', mileage: 3500, condition: 'excellent', estimated_value: 54000, nada_value: 55000, kbb_value: 53500, valuation_source: 'kbb' },
    ];
    await db('collateral').insert(collateral);
    console.log('  Collateral seeded');

    // 9. Seed Credit Reports
    const creditReports = [
      {
        application_id: 3, borrower_id: 3, pull_type: 'soft', bureau: 'experian', score: 710,
        tradelines: JSON.stringify([
          { creditor: 'Chase', type: 'credit_card', balance: 2500, limit: 10000, status: 'current' },
          { creditor: 'Wells Fargo', type: 'mortgage', balance: 180000, limit: 200000, status: 'current' },
        ]),
        inquiries: JSON.stringify([{ date: '2024-01-15', creditor: 'Auto Dealer' }]),
      },
      {
        application_id: 5, borrower_id: 5, pull_type: 'hard', bureau: 'equifax', score: 745,
        tradelines: JSON.stringify([
          { creditor: 'Discover', type: 'credit_card', balance: 1200, limit: 8000, status: 'current' },
          { creditor: 'Student Loan', type: 'installment', balance: 15000, limit: 30000, status: 'current' },
        ]),
        inquiries: JSON.stringify([]),
      },
      {
        application_id: 7, borrower_id: 2, pull_type: 'hard', bureau: 'transunion', score: 520,
        tradelines: JSON.stringify([
          { creditor: 'Capital One', type: 'credit_card', balance: 4800, limit: 5000, status: '30_days_late' },
          { creditor: 'Personal Loan', type: 'installment', balance: 8000, limit: 10000, status: '60_days_late' },
        ]),
        inquiries: JSON.stringify([
          { date: '2024-02-01', creditor: 'Lender A' },
          { date: '2024-01-15', creditor: 'Lender B' },
          { date: '2024-01-10', creditor: 'Lender C' },
        ]),
      },
    ];
    await db('credit_reports').insert(creditReports);
    console.log('  Credit reports seeded');

    // 10. Seed Conditions
    const conditions = [
      { application_id: 6, name: 'Proof of Insurance', description: 'Provide current vehicle insurance declaration page', category: 'prior_to_funding', status: 'pending', assigned_to: 1, created_by: 11 },
      { application_id: 6, name: 'Pay Stub Verification', description: 'Provide 2 most recent pay stubs', category: 'prior_to_approval', status: 'cleared', assigned_to: 1, created_by: 11, cleared_by: 11, cleared_at: new Date() },
      { application_id: 4, name: 'Property Appraisal', description: 'Complete home appraisal required', category: 'prior_to_approval', status: 'pending', assigned_to: 7, created_by: 12 },
      { application_id: 9, name: 'Title Verification', description: 'Clear vehicle title required', category: 'prior_to_funding', status: 'cleared', assigned_to: 7, created_by: 12, cleared_by: 12, cleared_at: new Date() },
    ];
    await db('conditions').insert(conditions);
    console.log('  Conditions seeded');

    // 11. Seed some decisions
    const decisions = [
      { application_id: 5, decided_by: null, decision_type: 'auto_approve', reason_codes: JSON.stringify(['CREDIT_SCORE_PASS', 'DTI_PASS']), approved_amount: 8000, approved_rate: 12.49, approved_term: 36 },
      { application_id: 7, decided_by: null, decision_type: 'auto_decline', reason_codes: JSON.stringify(['CREDIT_SCORE_FAIL', 'DTI_FAIL']) },
      { application_id: 8, decided_by: 12, decision_type: 'counter_offer', reason_codes: JSON.stringify(['AMOUNT_HIGH', 'INCOME_INSUFFICIENT']), approved_amount: 22000, approved_rate: 9.99, approved_term: 48, notes: 'Reduced amount based on income verification and collateral value' },
      { application_id: 6, decided_by: 11, decision_type: 'manual_approve', reason_codes: JSON.stringify(['CREDIT_SCORE_PASS', 'MANUAL_REVIEW_PASS']), approved_amount: 32000, approved_rate: 6.49, approved_term: 60, conditions: JSON.stringify(['Proof of Insurance', 'Pay Stub Verification']) },
    ];
    await db('decisions').insert(decisions);
    console.log('  Decisions seeded');

    // 12. Seed Loans (for funded applications)
    const loans = [
      {
        loan_number: 'RF-LN-2026-001', application_id: 10, borrower_id: 5,
        principal_amount: 6500, interest_rate: 14.99, term_months: 24,
        monthly_payment: 313.54, total_of_payments: 7524.96, finance_charge: 1024.96,
        apr: 14.99, first_payment_date: '2026-04-01', maturity_date: '2028-03-01',
        status: 'active',
      },
    ];
    await db('loans').insert(loans);
    console.log('  Loans seeded');

    // 13. Seed Audit Logs
    const auditLogs = [
      { user_id: 1, user_email: 'lo1@republicfinance.com', action: 'application_created', entity_type: 'application', entity_id: 1, details: JSON.stringify({ status: 'draft' }) },
      { user_id: 20, user_email: 'admin@republicfinance.com', action: 'user_created', entity_type: 'user', entity_id: 22, details: JSON.stringify({ role: 'borrower' }) },
      { user_id: 11, user_email: 'uw1@republicfinance.com', action: 'decision_made', entity_type: 'application', entity_id: 5, details: JSON.stringify({ decision: 'auto_approve', amount: 8000 }) },
      { user_id: 19, user_email: 'compliance@republicfinance.com', action: 'state_rule_updated', entity_type: 'state_rule', entity_id: 1, details: JSON.stringify({ field: 'max_rate_cap', old_value: 20, new_value: 18 }) },
    ];
    await db('audit_logs').insert(auditLogs);
    console.log('  Audit logs seeded');

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { seed };
