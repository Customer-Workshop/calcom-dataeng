const { db } = require('../config/database');
const { createAuditLog } = require('../utils/audit');
const { notifyStatusChange } = require('../utils/notifications');
const { generateAdverseActionPDF } = require('../utils/pdf');
const { decrypt, isEncrypted } = require('../utils/encryption');

/**
 * Rules-based decisioning engine.
 * Evaluates LTV + credit score + DTI against product and state rules
 * to auto-approve, refer to underwriter, or auto-decline.
 */

/** Decisioning bands for auto-approve / refer / decline */
const DECISION_BANDS = {
  auto_approve: {
    min_credit_score: 700,
    max_ltv: 80,
    max_dti: 36,
  },
  refer: {
    min_credit_score: 620,
    max_ltv: 95,
    max_dti: 45,
  },
  // Below refer thresholds = auto_decline
};

/** Calculate DTI ratio: (monthly debt / monthly income) * 100 */
function calculateDTI(monthlyDebt, annualIncome) {
  const monthlyIncome = annualIncome / 12;
  if (monthlyIncome <= 0) return 100;
  return Math.round((monthlyDebt / monthlyIncome) * 10000) / 100;
}

/** Run the decisioning engine against an application */
async function runDecisionEngine(applicationId, userId) {
  const application = await db('applications').where('id', applicationId).first();
  if (!application) throw new Error('Application not found');

  const borrower = await db('borrowers').where('id', application.borrower_id).first();
  if (!borrower) throw new Error('Borrower not found');

  const product = await db('loan_products').where('id', application.loan_product_id).first();
  const collateral = await db('collateral').where('application_id', applicationId).first();
  const creditReport = await db('credit_reports')
    .where('application_id', applicationId)
    .orderBy('created_at', 'desc')
    .first();

  // State rules check
  const stateRule = await db('state_rules').where('state', application.state).first();

  // Gather metrics
  const creditScore = creditReport ? creditReport.score : 0;
  const collateralValue = collateral ? parseFloat(collateral.estimated_value || 0) : 0;
  const requestedAmount = parseFloat(application.requested_amount);
  const isUnsecured = !product.requires_collateral;
  const ltvRatio = isUnsecured ? 0 : (collateralValue > 0 ? (requestedAmount / collateralValue) * 100 : 100);
  // Decrypt PII fields if encrypted (AES-256-GCM at rest)
  const rawDebt = isEncrypted(borrower.monthly_debt_payments) ? decrypt(borrower.monthly_debt_payments) : borrower.monthly_debt_payments;
  const rawIncome = isEncrypted(borrower.annual_income) ? decrypt(borrower.annual_income) : borrower.annual_income;
  const monthlyDebt = parseFloat(rawDebt || 0);
  const annualIncome = parseFloat(rawIncome || 0);

  // Include proposed loan payment in DTI calculation
  const estimatedMonthlyPayment = requestedAmount * (parseFloat(product.min_rate) / 100 / 12) /
    (1 - Math.pow(1 + parseFloat(product.min_rate) / 100 / 12, -application.term_months));
  const totalMonthlyDebt = monthlyDebt + estimatedMonthlyPayment;
  const dtiRatio = calculateDTI(totalMonthlyDebt, annualIncome);

  // Update application with calculated ratios
  await db('applications').where('id', applicationId).update({
    ltv_ratio: Math.round(ltvRatio * 100) / 100,
    dti_ratio: Math.round(dtiRatio * 100) / 100,
  });

  const reasonCodes = [];
  let decision = 'auto_approve';

  // Rule 1: Credit score check
  if (creditScore < (product.min_credit_score || 580)) {
    reasonCodes.push('CREDIT_SCORE_BELOW_MINIMUM');
    decision = 'auto_decline';
  } else if (creditScore < DECISION_BANDS.auto_approve.min_credit_score) {
    reasonCodes.push('CREDIT_SCORE_BELOW_AUTO_APPROVE');
    if (decision !== 'auto_decline') decision = 'refer';
  } else {
    reasonCodes.push('CREDIT_SCORE_PASS');
  }

  // Rule 2: LTV check (skip for unsecured products where max_ltv is 0)
  if (isUnsecured) {
    reasonCodes.push('LTV_NOT_APPLICABLE');
  } else if (ltvRatio > parseFloat(product.max_ltv || 100)) {
    reasonCodes.push('LTV_EXCEEDS_PRODUCT_MAX');
    decision = 'auto_decline';
  } else if (ltvRatio > DECISION_BANDS.refer.max_ltv) {
    reasonCodes.push('LTV_EXCEEDS_REFER_THRESHOLD');
    if (decision !== 'auto_decline') decision = 'refer';
  } else if (ltvRatio > DECISION_BANDS.auto_approve.max_ltv) {
    reasonCodes.push('LTV_ABOVE_AUTO_APPROVE');
    if (decision !== 'auto_decline') decision = 'refer';
  } else {
    reasonCodes.push('LTV_PASS');
  }

  // Rule 3: DTI check
  if (dtiRatio > 50) {
    reasonCodes.push('DTI_EXCEEDS_MAXIMUM');
    decision = 'auto_decline';
  } else if (dtiRatio > DECISION_BANDS.refer.max_dti) {
    reasonCodes.push('DTI_EXCEEDS_REFER_THRESHOLD');
    if (decision !== 'auto_decline') decision = 'refer';
  } else if (dtiRatio > DECISION_BANDS.auto_approve.max_dti) {
    reasonCodes.push('DTI_ABOVE_AUTO_APPROVE');
    if (decision !== 'auto_decline') decision = 'refer';
  } else {
    reasonCodes.push('DTI_PASS');
  }

  // Rule 4: State rules check
  if (stateRule) {
    if (!stateRule.is_enabled) {
      reasonCodes.push('STATE_NOT_ENABLED');
      decision = 'auto_decline';
    }
    if (stateRule.max_loan_amount && requestedAmount > parseFloat(stateRule.max_loan_amount)) {
      reasonCodes.push('EXCEEDS_STATE_MAX_AMOUNT');
      decision = 'auto_decline';
    }
    if (stateRule.min_loan_amount && requestedAmount < parseFloat(stateRule.min_loan_amount)) {
      reasonCodes.push('BELOW_STATE_MIN_AMOUNT');
      decision = 'auto_decline';
    }
  }

  // Rule 5: Product amount limits
  if (requestedAmount > parseFloat(product.max_amount)) {
    reasonCodes.push('EXCEEDS_PRODUCT_MAX_AMOUNT');
    decision = 'auto_decline';
  }
  if (requestedAmount < parseFloat(product.min_amount)) {
    reasonCodes.push('BELOW_PRODUCT_MIN_AMOUNT');
    decision = 'auto_decline';
  }

  // Determine approved rate based on credit score
  let approvedRate = parseFloat(product.max_rate);
  if (creditScore >= 760) approvedRate = parseFloat(product.min_rate);
  else if (creditScore >= 720) approvedRate = parseFloat(product.min_rate) + 1;
  else if (creditScore >= 680) approvedRate = parseFloat(product.min_rate) + 2;
  else if (creditScore >= 640) approvedRate = parseFloat(product.min_rate) + 3;

  // Check state rate cap
  if (stateRule && stateRule.max_rate_cap && approvedRate > parseFloat(stateRule.max_rate_cap)) {
    approvedRate = parseFloat(stateRule.max_rate_cap);
  }

  // Apply decision
  let newStatus, approvedAmount;
  if (decision === 'auto_approve') {
    newStatus = 'approved';
    approvedAmount = requestedAmount;
  } else if (decision === 'refer') {
    newStatus = 'underwriting';
  } else {
    newStatus = 'declined';
  }

  // Update application
  const updateData = {
    status: newStatus,
    decision: decision === 'auto_approve' ? 'auto_approve' : decision === 'auto_decline' ? 'auto_decline' : 'refer',
    decision_reasons: JSON.stringify(reasonCodes),
    decision_at: new Date(),
  };

  if (decision === 'auto_approve') {
    updateData.approved_amount = approvedAmount;
    updateData.interest_rate = approvedRate;
  }

  // Generate adverse action notice on decline
  if (decision === 'auto_decline') {
    const friendlyReasons = reasonCodes.map(code => {
      const map = {
        CREDIT_SCORE_BELOW_MINIMUM: 'Credit score does not meet minimum requirements',
        DTI_EXCEEDS_MAXIMUM: 'Debt-to-income ratio exceeds maximum allowed',
        LTV_EXCEEDS_PRODUCT_MAX: 'Loan-to-value ratio exceeds product limits',
        STATE_NOT_ENABLED: 'Lending not available in your state',
        EXCEEDS_STATE_MAX_AMOUNT: 'Requested amount exceeds state maximum',
        BELOW_STATE_MIN_AMOUNT: 'Requested amount below state minimum',
        EXCEEDS_PRODUCT_MAX_AMOUNT: 'Requested amount exceeds product maximum',
        BELOW_PRODUCT_MIN_AMOUNT: 'Requested amount below product minimum',
      };
      return map[code] || code;
    }).filter(r => !r.includes('PASS'));

    updateData.adverse_action_notice = `NOTICE OF ADVERSE ACTION\n\nDate: ${new Date().toLocaleDateString()}\nApplication: ${application.application_number}\n\nYour application for credit has been denied for the following reasons:\n${friendlyReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nYou have the right to obtain a free copy of your credit report within 60 days.`;
  }

  await db('applications').where('id', applicationId).update(updateData);

  // Create decision record
  const [decisionRecord] = await db('decisions').insert({
    application_id: applicationId,
    decided_by: userId || null,
    decision_type: updateData.decision,
    reason_codes: JSON.stringify(reasonCodes),
    approved_amount: decision === 'auto_approve' ? approvedAmount : null,
    approved_rate: decision === 'auto_approve' ? approvedRate : null,
    approved_term: decision === 'auto_approve' ? application.term_months : null,
  }).returning('*');

  // Send notification
  const updatedApp = await db('applications').where('id', applicationId).first();
  await notifyStatusChange(updatedApp, newStatus);

  await createAuditLog({
    userId,
    action: 'decision_engine_run',
    entityType: 'application',
    entityId: applicationId,
    details: { decision, reasonCodes, creditScore, ltvRatio, dtiRatio, approvedAmount, approvedRate },
  });

  return {
    decision,
    status: newStatus,
    reasonCodes,
    metrics: { creditScore, ltvRatio: Math.round(ltvRatio * 100) / 100, dtiRatio: Math.round(dtiRatio * 100) / 100 },
    approvedAmount: decision === 'auto_approve' ? approvedAmount : null,
    approvedRate: decision === 'auto_approve' ? approvedRate : null,
    decisionRecord,
  };
}

module.exports = { runDecisionEngine, calculateDTI, DECISION_BANDS };
