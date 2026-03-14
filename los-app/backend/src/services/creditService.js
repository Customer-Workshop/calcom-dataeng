const { db } = require('../config/database');
const { createAuditLog } = require('../utils/audit');
const { decrypt, isEncrypted } = require('../utils/encryption');

/**
 * Mock credit bureau service. Simulates soft and hard credit pulls.
 * In production, this would integrate with Experian, Equifax, TransUnion APIs.
 */

/** Generate a mock credit score based on borrower financial profile */
function generateMockCreditScore(borrower) {
  let baseScore = 680;
  // Decrypt PII fields if encrypted (AES-256-GCM at rest)
  const rawIncome = isEncrypted(borrower.annual_income) ? decrypt(borrower.annual_income) : borrower.annual_income;
  const rawDebt = isEncrypted(borrower.monthly_debt_payments) ? decrypt(borrower.monthly_debt_payments) : borrower.monthly_debt_payments;
  const income = parseFloat(rawIncome || 0);
  const debt = parseFloat(rawDebt || 0);
  const yearsEmployed = borrower.years_employed || 0;

  if (income > 100000) baseScore += 40;
  else if (income > 75000) baseScore += 25;
  else if (income > 50000) baseScore += 10;
  else if (income < 30000) baseScore -= 20;

  const monthlyIncome = income / 12;
  const dti = monthlyIncome > 0 ? (debt / monthlyIncome) * 100 : 100;
  if (dti < 20) baseScore += 30;
  else if (dti < 35) baseScore += 10;
  else if (dti > 50) baseScore -= 40;

  if (yearsEmployed >= 5) baseScore += 20;
  else if (yearsEmployed >= 2) baseScore += 10;
  else if (yearsEmployed === 0) baseScore -= 15;

  // Add some randomness
  baseScore += Math.floor(Math.random() * 40) - 20;
  return Math.max(300, Math.min(850, baseScore));
}

/** Generate mock tradelines for credit report */
function generateMockTradelines() {
  const types = ['credit_card', 'installment', 'mortgage', 'auto_loan', 'student_loan'];
  const statuses = ['current', 'current', 'current', '30_days_late', '60_days_late'];
  const creditors = ['Chase', 'Wells Fargo', 'Capital One', 'Discover', 'Citi', 'Bank of America'];
  const count = 2 + Math.floor(Math.random() * 4);
  const tradelines = [];

  for (let i = 0; i < count; i++) {
    tradelines.push({
      creditor: creditors[Math.floor(Math.random() * creditors.length)],
      type: types[Math.floor(Math.random() * types.length)],
      balance: Math.floor(Math.random() * 30000) + 500,
      limit: Math.floor(Math.random() * 50000) + 5000,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      opened_date: new Date(Date.now() - Math.random() * 5 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
  }
  return tradelines;
}

/** Perform a soft credit pull (pre-qualification) */
async function softCreditPull(applicationId, borrowerId, userId) {
  const borrower = await db('borrowers').where('id', borrowerId).first();
  if (!borrower) throw new Error('Borrower not found');

  const score = generateMockCreditScore(borrower);
  const tradelines = generateMockTradelines();

  const [report] = await db('credit_reports').insert({
    application_id: applicationId,
    borrower_id: borrowerId,
    pull_type: 'soft',
    bureau: 'experian',
    score,
    tradelines: JSON.stringify(tradelines),
    inquiries: JSON.stringify([]),
    public_records: JSON.stringify([]),
    raw_response: JSON.stringify({ type: 'soft_pull', score, tradelines, generated: true }),
    pulled_at: new Date(),
  }).returning('*');

  await createAuditLog({
    userId,
    action: 'soft_credit_pull',
    entityType: 'credit_report',
    entityId: report.id,
    details: { applicationId, borrowerId, score, pullType: 'soft' },
  });

  console.log(`[CREDIT] Soft pull for application ${applicationId}: Score ${score}`);
  return report;
}

/** Perform a hard credit pull (full application) */
async function hardCreditPull(applicationId, borrowerId, userId) {
  const borrower = await db('borrowers').where('id', borrowerId).first();
  if (!borrower) throw new Error('Borrower not found');

  const score = generateMockCreditScore(borrower);
  const tradelines = generateMockTradelines();
  const inquiries = [
    { date: new Date().toISOString().split('T')[0], creditor: 'LOS System - Hard Pull' },
  ];

  const [report] = await db('credit_reports').insert({
    application_id: applicationId,
    borrower_id: borrowerId,
    pull_type: 'hard',
    bureau: ['experian', 'equifax', 'transunion'][Math.floor(Math.random() * 3)],
    score,
    tradelines: JSON.stringify(tradelines),
    inquiries: JSON.stringify(inquiries),
    public_records: JSON.stringify([]),
    raw_response: JSON.stringify({ type: 'hard_pull', score, tradelines, inquiries, generated: true }),
    pulled_at: new Date(),
  }).returning('*');

  // Update application status
  await db('applications').where('id', applicationId).update({ status: 'credit_pulled' });

  await createAuditLog({
    userId,
    action: 'hard_credit_pull',
    entityType: 'credit_report',
    entityId: report.id,
    details: { applicationId, borrowerId, score, pullType: 'hard' },
  });

  console.log(`[CREDIT] Hard pull for application ${applicationId}: Score ${score}`);
  return report;
}

module.exports = { softCreditPull, hardCreditPull, generateMockCreditScore };
