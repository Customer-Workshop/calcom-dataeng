const express = require('express');
const { db } = require('../config/database');
const { authenticate, authorize, checkAuthorityLimit } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const { createAuditLog } = require('../utils/audit');
const { notifyStatusChange } = require('../utils/notifications');
const { softCreditPull, hardCreditPull } = require('../services/creditService');
const { runIdentityCheck } = require('../services/identityService');
const { runDecisionEngine } = require('../services/decisioningService');
const { upsertCollateral, calculateLTV } = require('../services/collateralService');
const { generateTILADisclosure } = require('../services/tilaService');
const { generateLoanAgreementPDF, generateAdverseActionPDF } = require('../utils/pdf');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

/** GET /api/applications - List applications with pagination and filters */
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, branch_id, loan_officer_id, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = db('applications')
      .leftJoin('borrowers', 'applications.borrower_id', 'borrowers.id')
      .leftJoin('users as borrower_user', 'borrowers.user_id', 'borrower_user.id')
      .leftJoin('users as officer', 'applications.loan_officer_id', 'officer.id')
      .leftJoin('loan_products', 'applications.loan_product_id', 'loan_products.id')
      .leftJoin('branches', 'applications.branch_id', 'branches.id');

    // Role-based filtering
    if (req.user.role === 'borrower') {
      const borrower = await db('borrowers').where('user_id', req.user.id).first();
      if (borrower) {
        query = query.where('applications.borrower_id', borrower.id);
      } else {
        return res.json({ data: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      }
    } else if (req.user.role === 'loan_officer') {
      query = query.where('applications.loan_officer_id', req.user.id);
    } else if (req.user.role === 'branch_manager') {
      query = query.where('applications.branch_id', req.user.branch_id);
    } else if (req.user.role === 'underwriter') {
      query = query.where(function() {
        this.where('applications.underwriter_id', req.user.id)
          .orWhere('applications.status', 'underwriting');
      });
    }

    if (status) query = query.where('applications.status', status);
    if (branch_id) query = query.where('applications.branch_id', parseInt(branch_id));
    if (loan_officer_id) query = query.where('applications.loan_officer_id', parseInt(loan_officer_id));
    if (search) {
      query = query.where(function() {
        this.where('applications.application_number', 'ilike', `%${search}%`)
          .orWhere('borrower_user.first_name', 'ilike', `%${search}%`)
          .orWhere('borrower_user.last_name', 'ilike', `%${search}%`);
      });
    }

    const countQuery = query.clone().count('applications.id as count').first();

    const applications = await query
      .select(
        'applications.*',
        'borrower_user.first_name as borrower_first_name',
        'borrower_user.last_name as borrower_last_name',
        'officer.first_name as officer_first_name',
        'officer.last_name as officer_last_name',
        'loan_products.name as product_name',
        'branches.name as branch_name'
      )
      .orderBy('applications.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    const { count } = await countQuery;

    res.json({
      data: applications,
      total: parseInt(count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('List applications error:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

/** GET /api/applications/:id - Get single application with all related data */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const application = await db('applications')
      .leftJoin('borrowers', 'applications.borrower_id', 'borrowers.id')
      .leftJoin('users as borrower_user', 'borrowers.user_id', 'borrower_user.id')
      .leftJoin('users as officer', 'applications.loan_officer_id', 'officer.id')
      .leftJoin('users as uw', 'applications.underwriter_id', 'uw.id')
      .leftJoin('loan_products', 'applications.loan_product_id', 'loan_products.id')
      .leftJoin('branches', 'applications.branch_id', 'branches.id')
      .where('applications.id', req.params.id)
      .select(
        'applications.*',
        'borrowers.ssn_last_four', 'borrowers.date_of_birth', 'borrowers.address_street',
        'borrowers.address_city', 'borrowers.address_state', 'borrowers.address_zip',
        'borrowers.employer_name', 'borrowers.employment_status', 'borrowers.annual_income',
        'borrowers.monthly_debt_payments', 'borrowers.income_source', 'borrowers.years_employed',
        'borrower_user.first_name as borrower_first_name', 'borrower_user.last_name as borrower_last_name',
        'borrower_user.email as borrower_email',
        'officer.first_name as officer_first_name', 'officer.last_name as officer_last_name',
        'uw.first_name as underwriter_first_name', 'uw.last_name as underwriter_last_name',
        'loan_products.name as product_name', 'loan_products.type as product_type',
        'branches.name as branch_name'
      )
      .first();

    if (!application) return res.status(404).json({ error: 'Application not found' });

    // Fetch related data
    const collateral = await db('collateral').where('application_id', req.params.id);
    const creditReports = await db('credit_reports').where('application_id', req.params.id).orderBy('created_at', 'desc');
    const conditions = await db('conditions')
      .leftJoin('users as assignee', 'conditions.assigned_to', 'assignee.id')
      .leftJoin('users as creator', 'conditions.created_by', 'creator.id')
      .where('conditions.application_id', req.params.id)
      .select('conditions.*',
        'assignee.first_name as assignee_first_name', 'assignee.last_name as assignee_last_name',
        'creator.first_name as creator_first_name', 'creator.last_name as creator_last_name');
    const documents = await db('documents').where('application_id', req.params.id);
    const decisions = await db('decisions')
      .leftJoin('users', 'decisions.decided_by', 'users.id')
      .where('decisions.application_id', req.params.id)
      .select('decisions.*', 'users.first_name as decided_by_name', 'users.last_name as decided_by_last')
      .orderBy('decisions.created_at', 'desc');

    res.json({
      ...application,
      collateral,
      credit_reports: creditReports,
      conditions,
      documents,
      decisions,
    });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to fetch application' });
  }
});

/** POST /api/applications - Create a new application */
router.post('/', authenticate, validateBody(schemas.application), async (req, res) => {
  try {
    const { loan_product_id, requested_amount, term_months, purpose, state, borrower_info, co_borrower_info } = req.body;

    // Create or update borrower profile
    let borrower = await db('borrowers').where('user_id', req.user.id).first();
    if (!borrower) {
      [borrower] = await db('borrowers').insert({
        user_id: req.user.id,
        ...borrower_info,
      }).returning('*');
    } else if (borrower_info) {
      [borrower] = await db('borrowers').where('id', borrower.id).update({
        ...borrower_info,
        updated_at: new Date(),
      }).returning('*');
    }

    // Assign to loan officer (round-robin within branch)
    const branchByState = await db('branches').where('state', state).first();
    const branchId = branchByState ? branchByState.id : 1;
    const loanOfficerRole = await db('roles').where('name', 'loan_officer').first();
    const officers = await db('users').where({ role_id: loanOfficerRole.id, branch_id: branchId, is_active: true });
    const assignedOfficer = officers.length > 0 ? officers[Math.floor(Math.random() * officers.length)] : null;

    const applicationNumber = 'APP-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    const [application] = await db('applications').insert({
      application_number: applicationNumber,
      borrower_id: borrower.id,
      loan_product_id,
      loan_officer_id: assignedOfficer ? assignedOfficer.id : null,
      branch_id: branchId,
      requested_amount,
      term_months,
      purpose,
      state,
      status: 'submitted',
      submitted_at: new Date(),
    }).returning('*');

    await notifyStatusChange(application, 'submitted');

    await createAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'application_created',
      entityType: 'application',
      entityId: application.id,
      details: { applicationNumber, requestedAmount: requested_amount, state },
      ipAddress: req.ip,
    });

    res.status(201).json(application);
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: 'Failed to create application' });
  }
});

/** PUT /api/applications/:id - Update application */
router.put('/:id', authenticate, async (req, res) => {
  try {
    const allowed = ['requested_amount', 'term_months', 'purpose', 'state', 'loan_product_id'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date();

    const [application] = await db('applications').where('id', req.params.id).update(updates).returning('*');
    if (!application) return res.status(404).json({ error: 'Application not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'application_updated',
      entityType: 'application',
      entityId: application.id,
      details: updates,
    });

    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update application' });
  }
});

/** POST /api/applications/:id/pre-qualify - Run soft credit pull for pre-qualification */
router.post('/:id/pre-qualify', authenticate, async (req, res) => {
  try {
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const report = await softCreditPull(application.id, application.borrower_id, req.user.id);
    await db('applications').where('id', req.params.id).update({ status: 'pre_qualified' });
    await notifyStatusChange(application, 'pre_qualified');

    res.json({ credit_report: report, status: 'pre_qualified' });
  } catch (error) {
    console.error('Pre-qualify error:', error);
    res.status(500).json({ error: 'Pre-qualification failed' });
  }
});

/** POST /api/applications/:id/credit-pull - Run hard credit pull */
router.post('/:id/credit-pull', authenticate, authorize('loan_officer', 'underwriter', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const report = await hardCreditPull(application.id, application.borrower_id, req.user.id);
    res.json({ credit_report: report });
  } catch (error) {
    console.error('Credit pull error:', error);
    res.status(500).json({ error: 'Credit pull failed' });
  }
});

/** POST /api/applications/:id/identity-check - Run identity and fraud verification */
router.post('/:id/identity-check', authenticate, authorize('loan_officer', 'underwriter', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const result = await runIdentityCheck(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Identity check error:', error);
    res.status(500).json({ error: 'Identity check failed' });
  }
});

/** POST /api/applications/:id/verify-income - Mark income as verified */
router.post('/:id/verify-income', authenticate, authorize('loan_officer', 'underwriter', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    await db('applications').where('id', req.params.id).update({ status: 'income_verified' });
    await notifyStatusChange(application, 'income_verified');

    await createAuditLog({
      userId: req.user.id,
      action: 'income_verified',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: { verified_by: req.user.id },
    });

    res.json({ status: 'income_verified' });
  } catch (error) {
    res.status(500).json({ error: 'Income verification failed' });
  }
});

/** POST /api/applications/:id/decision - Run decisioning engine */
router.post('/:id/decision', authenticate, authorize('loan_officer', 'underwriter', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const result = await runDecisionEngine(parseInt(req.params.id), req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Decision error:', error);
    res.status(500).json({ error: 'Decision engine failed' });
  }
});

/** POST /api/applications/:id/manual-decision - Manual underwriter decision */
router.post('/:id/manual-decision', authenticate, authorize('underwriter', 'branch_manager', 'system_admin'),
  checkAuthorityLimit, validateBody(schemas.decision), async (req, res) => {
  try {
    const { decision_type, approved_amount, approved_rate, approved_term, reason_codes, conditions: conditionsList, notes } = req.body;
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    let newStatus;
    const updateData = {
      decision: decision_type,
      decision_reasons: JSON.stringify(reason_codes || []),
      decision_at: new Date(),
    };

    switch (decision_type) {
      case 'manual_approve':
        newStatus = conditionsList && conditionsList.length > 0 ? 'conditionally_approved' : 'approved';
        updateData.approved_amount = approved_amount || application.requested_amount;
        updateData.interest_rate = approved_rate;
        break;
      case 'manual_decline':
        newStatus = 'declined';
        // Generate adverse action notice
        const friendlyReasons = (reason_codes || []).map(code => code.replace(/_/g, ' ').toLowerCase());
        updateData.adverse_action_notice = `NOTICE OF ADVERSE ACTION\nDate: ${new Date().toLocaleDateString()}\nApplication: ${application.application_number}\n\nDenied for: ${friendlyReasons.join(', ')}`;
        break;
      case 'counter_offer':
        newStatus = 'counter_offered';
        updateData.approved_amount = approved_amount;
        updateData.interest_rate = approved_rate;
        break;
      case 'refer':
        newStatus = 'underwriting';
        break;
    }
    updateData.status = newStatus;

    await db('applications').where('id', req.params.id).update(updateData);

    // Create decision record
    const [decision] = await db('decisions').insert({
      application_id: parseInt(req.params.id),
      decided_by: req.user.id,
      decision_type,
      reason_codes: JSON.stringify(reason_codes || []),
      approved_amount: approved_amount || null,
      approved_rate: approved_rate || null,
      approved_term: approved_term || null,
      notes,
      conditions: conditionsList ? JSON.stringify(conditionsList) : null,
    }).returning('*');

    // Create condition records if provided
    if (conditionsList && conditionsList.length > 0) {
      for (const cond of conditionsList) {
        await db('conditions').insert({
          application_id: parseInt(req.params.id),
          name: typeof cond === 'string' ? cond : cond.name,
          description: typeof cond === 'object' ? cond.description : null,
          category: typeof cond === 'object' ? cond.category : 'prior_to_funding',
          status: 'pending',
          created_by: req.user.id,
        });
      }
    }

    const updatedApp = await db('applications').where('id', req.params.id).first();
    await notifyStatusChange(updatedApp, newStatus);

    await createAuditLog({
      userId: req.user.id,
      action: 'manual_decision',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: { decision_type, approved_amount, approved_rate, reason_codes, is_override: false },
    });

    res.json({ decision, status: newStatus });
  } catch (error) {
    console.error('Manual decision error:', error);
    res.status(500).json({ error: 'Manual decision failed' });
  }
});

/** POST /api/applications/:id/counter-offer-response - Borrower accepts/rejects counter offer */
router.post('/:id/counter-offer-response', authenticate, async (req, res) => {
  try {
    const { accept } = req.body;
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.status !== 'counter_offered') return res.status(400).json({ error: 'Application not in counter offer state' });

    const newStatus = accept ? 'approved' : 'withdrawn';
    await db('applications').where('id', req.params.id).update({ status: newStatus });
    await notifyStatusChange(application, newStatus);

    await createAuditLog({
      userId: req.user.id,
      action: accept ? 'counter_offer_accepted' : 'counter_offer_rejected',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: { accepted: accept },
    });

    res.json({ status: newStatus });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process counter offer response' });
  }
});

/** POST /api/applications/:id/e-sign - E-signature flow */
router.post('/:id/e-sign', authenticate, validateBody(schemas.eSignature), async (req, res) => {
  try {
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    if (!['approved', 'conditionally_approved'].includes(application.status)) {
      // Also allow if all conditions cleared
      const pendingConditions = await db('conditions')
        .where({ application_id: req.params.id })
        .whereNotIn('status', ['cleared', 'waived'])
        .count('id as count')
        .first();
      if (parseInt(pendingConditions.count) > 0) {
        return res.status(400).json({ error: 'Outstanding conditions must be cleared before signing' });
      }
    }

    const borrower = await db('borrowers').where('id', application.borrower_id).first();

    // Generate TILA disclosure
    const tila = generateTILADisclosure(
      parseFloat(application.approved_amount || application.requested_amount),
      parseFloat(application.interest_rate || 7.99),
      application.term_months
    );

    // Create e-signature record
    const [esig] = await db('e_signatures').insert({
      application_id: parseInt(req.params.id),
      borrower_id: application.borrower_id,
      document_type: 'loan_agreement',
      signature_data: req.body.signature_data,
      signer_name: req.body.signer_name,
      signer_ip: req.ip,
      signed_at: new Date(),
      status: 'signed',
    }).returning('*');

    await db('applications').where('id', req.params.id).update({ status: 'e_signed' });
    await notifyStatusChange(application, 'e_signed');

    await createAuditLog({
      userId: req.user.id,
      action: 'e_signature_captured',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: { signer: req.body.signer_name, tila },
    });

    res.json({ e_signature: esig, tila_disclosure: tila, status: 'e_signed' });
  } catch (error) {
    console.error('E-sign error:', error);
    res.status(500).json({ error: 'E-signature failed' });
  }
});

/** POST /api/applications/:id/fund - Authorize funding */
router.post('/:id/fund', authenticate, authorize('loan_officer', 'branch_manager', 'underwriter', 'system_admin'), async (req, res) => {
  try {
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });
    if (application.status !== 'e_signed' && application.status !== 'funding_authorized') {
      return res.status(400).json({ error: 'Application must be e-signed before funding' });
    }

    const amount = parseFloat(application.approved_amount || application.requested_amount);
    const rate = parseFloat(application.interest_rate || 7.99);
    const term = application.term_months;

    // Calculate TILA values
    const tila = generateTILADisclosure(amount, rate, term);

    // Create loan record
    const loanNumber = 'LN-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-6);
    const firstPaymentDate = new Date();
    firstPaymentDate.setMonth(firstPaymentDate.getMonth() + 1);
    firstPaymentDate.setDate(1);
    const maturityDate = new Date(firstPaymentDate);
    maturityDate.setMonth(maturityDate.getMonth() + term);

    const [loan] = await db('loans').insert({
      loan_number: loanNumber,
      application_id: parseInt(req.params.id),
      borrower_id: application.borrower_id,
      principal_amount: amount,
      interest_rate: rate,
      term_months: term,
      monthly_payment: tila.monthly_payment,
      total_of_payments: tila.total_of_payments,
      finance_charge: tila.finance_charge,
      apr: rate,
      first_payment_date: firstPaymentDate,
      maturity_date: maturityDate,
      status: 'active',
    }).returning('*');

    // Create funding instruction
    const [funding] = await db('funding_instructions').insert({
      loan_id: loan.id,
      application_id: parseInt(req.params.id),
      disbursement_method: req.body.disbursement_method || 'ach',
      account_number: req.body.account_number || '****1234',
      routing_number: req.body.routing_number || '****5678',
      account_holder_name: req.body.account_holder_name || 'Borrower',
      amount,
      status: 'authorized',
      authorized_by: req.user.id,
      authorized_at: new Date(),
    }).returning('*');

    // Update application status
    await db('applications').where('id', req.params.id).update({
      status: 'funded',
      funded_at: new Date(),
    });
    await notifyStatusChange(application, 'funded');

    await createAuditLog({
      userId: req.user.id,
      action: 'loan_funded',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: { loanNumber, amount, rate, term, fundingId: funding.id },
    });

    res.json({ loan, funding, tila_disclosure: tila });
  } catch (error) {
    console.error('Funding error:', error);
    res.status(500).json({ error: 'Funding failed' });
  }
});

/** POST /api/applications/:id/handoff - Export loan to servicing */
router.post('/:id/handoff', authenticate, authorize('loan_officer', 'branch_manager', 'system_admin'), async (req, res) => {
  try {
    const application = await db('applications').where('id', req.params.id).first();
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const loan = await db('loans').where('application_id', req.params.id).first();
    const borrower = await db('borrowers').where('id', application.borrower_id).first();
    const collateral = await db('collateral').where('application_id', req.params.id);
    const documents = await db('documents').where('application_id', req.params.id);
    const conditions = await db('conditions').where('application_id', req.params.id);

    const servicingPackage = {
      loan,
      application,
      borrower,
      collateral,
      documents: documents.map(d => ({ id: d.id, name: d.name, category: d.category })),
      conditions,
      exported_at: new Date().toISOString(),
      exported_by: req.user.id,
    };

    // Update loan status
    if (loan) {
      await db('loans').where('id', loan.id).update({
        status: 'in_servicing',
        servicing_data: JSON.stringify(servicingPackage),
      });
    }
    await db('applications').where('id', req.params.id).update({ status: 'servicing' });

    await createAuditLog({
      userId: req.user.id,
      action: 'loan_handoff_to_servicing',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: { loanNumber: loan ? loan.loan_number : null },
    });

    res.json({ servicing_package: servicingPackage });
  } catch (error) {
    res.status(500).json({ error: 'Handoff failed' });
  }
});

/** POST /api/applications/:id/reassign - Reassign loan officer (branch manager) */
router.post('/:id/reassign', authenticate, authorize('branch_manager', 'system_admin'), async (req, res) => {
  try {
    const { loan_officer_id, underwriter_id } = req.body;
    const updates = {};
    if (loan_officer_id) updates.loan_officer_id = loan_officer_id;
    if (underwriter_id) updates.underwriter_id = underwriter_id;

    const [application] = await db('applications').where('id', req.params.id).update(updates).returning('*');
    if (!application) return res.status(404).json({ error: 'Application not found' });

    await createAuditLog({
      userId: req.user.id,
      action: 'application_reassigned',
      entityType: 'application',
      entityId: parseInt(req.params.id),
      details: updates,
    });

    res.json(application);
  } catch (error) {
    res.status(500).json({ error: 'Reassignment failed' });
  }
});

module.exports = router;
