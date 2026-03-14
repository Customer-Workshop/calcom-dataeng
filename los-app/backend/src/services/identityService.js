const { db } = require('../config/database');
const { createAuditLog } = require('../utils/audit');

/**
 * Mock identity and fraud check service.
 * Simulates OFAC screening and SSN validation.
 * In production, would integrate with real identity verification APIs.
 */

/** Mock OFAC/SDN list check */
function checkOFAC(firstName, lastName) {
  // Mock blocked names for testing
  const blockedNames = ['BLOCKED_TEST', 'SANCTIONS_TEST'];
  const fullName = `${firstName} ${lastName}`.toUpperCase();
  const isBlocked = blockedNames.some(name => fullName.includes(name));
  return {
    passed: !isBlocked,
    source: 'OFAC_SDN',
    checked_at: new Date().toISOString(),
    match_found: isBlocked,
    details: isBlocked ? 'Potential match found on OFAC SDN list' : 'No match found',
  };
}

/** Mock SSN validation */
function validateSSN(ssnLastFour) {
  // Basic validation: must be 4 digits, not all zeros
  const isValid = /^\d{4}$/.test(ssnLastFour) && ssnLastFour !== '0000';
  return {
    passed: isValid,
    source: 'SSN_VALIDATION',
    checked_at: new Date().toISOString(),
    details: isValid ? 'SSN format validated' : 'Invalid SSN format',
  };
}

/** Run full identity and fraud verification for an application */
async function runIdentityCheck(applicationId, userId) {
  const application = await db('applications').where('id', applicationId).first();
  if (!application) throw new Error('Application not found');

  const borrower = await db('borrowers').where('id', application.borrower_id).first();
  if (!borrower) throw new Error('Borrower not found');

  const user = await db('users').where('id', borrower.user_id).first();

  // Run OFAC check
  const ofacResult = checkOFAC(user.first_name, user.last_name);

  // Run SSN validation
  const ssnResult = validateSSN(borrower.ssn_last_four);

  const allPassed = ofacResult.passed && ssnResult.passed;

  if (allPassed) {
    await db('applications').where('id', applicationId).update({ status: 'identity_verified' });
  }

  await createAuditLog({
    userId,
    action: 'identity_check',
    entityType: 'application',
    entityId: applicationId,
    details: { ofacResult, ssnResult, allPassed },
  });

  console.log(`[IDENTITY] Check for application ${applicationId}: ${allPassed ? 'PASSED' : 'FAILED'}`);

  return {
    passed: allPassed,
    checks: { ofac: ofacResult, ssn: ssnResult },
  };
}

module.exports = { runIdentityCheck, checkOFAC, validateSSN };
