const express = require('express');
const { db } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/** GET /api/reporting/dashboard - Executive KPI dashboard */
router.get('/dashboard', authenticate, authorize('executive', 'system_admin', 'branch_manager', 'compliance_officer'), async (req, res) => {
  try {
    const { start_date, end_date, branch_id } = req.query;

    let baseQuery = db('applications');
    if (start_date) baseQuery = baseQuery.where('applications.created_at', '>=', start_date);
    if (end_date) baseQuery = baseQuery.where('applications.created_at', '<=', end_date);
    if (branch_id) baseQuery = baseQuery.where('applications.branch_id', parseInt(branch_id));

    // For branch managers, filter by their branch
    if (req.user.role === 'branch_manager') {
      baseQuery = baseQuery.where('applications.branch_id', req.user.branch_id);
    }

    // Total applications
    const totalApps = await baseQuery.clone().count('id as count').first();

    // Applications by status
    const byStatus = await baseQuery.clone()
      .select('status')
      .count('id as count')
      .groupBy('status');

    // Approval rate
    const approved = await baseQuery.clone().whereIn('status', ['approved', 'conditionally_approved', 'e_signed', 'funded', 'servicing']).count('id as count').first();
    const declined = await baseQuery.clone().where('status', 'declined').count('id as count').first();
    const decided = parseInt(approved.count) + parseInt(declined.count);
    const approvalRate = decided > 0 ? Math.round((parseInt(approved.count) / decided) * 10000) / 100 : 0;

    // Average LTV
    const avgLTV = await baseQuery.clone().whereNotNull('ltv_ratio').avg('ltv_ratio as avg_ltv').first();

    // Average time to fund (days) — respects branch/date filters
    const fundedApps = await baseQuery.clone()
      .whereNotNull('funded_at')
      .whereNotNull('submitted_at')
      .select(db.raw("AVG(EXTRACT(EPOCH FROM (funded_at - submitted_at)) / 86400) as avg_days"));
    const avgTimeToFund = fundedApps[0] ? Math.round((parseFloat(fundedApps[0].avg_days) || 0) * 100) / 100 : 0;

    // Volume by state
    const byState = await baseQuery.clone()
      .select('state')
      .count('id as count')
      .sum('requested_amount as total_amount')
      .groupBy('state')
      .orderBy('count', 'desc');

    // Volume by branch
    const byBranch = await baseQuery.clone()
      .leftJoin('branches', 'applications.branch_id', 'branches.id')
      .select('branches.name as branch_name')
      .count('applications.id as count')
      .sum('applications.requested_amount as total_amount')
      .groupBy('branches.name')
      .orderBy('count', 'desc');

    // Volume by product
    const byProduct = await baseQuery.clone()
      .leftJoin('loan_products', 'applications.loan_product_id', 'loan_products.id')
      .select('loan_products.name as product_name')
      .count('applications.id as count')
      .sum('applications.requested_amount as total_amount')
      .groupBy('loan_products.name');

    // Monthly trend (last 6 months)
    const monthlyTrend = await db.raw(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count,
        SUM(requested_amount) as total_amount,
        COUNT(CASE WHEN status IN ('approved', 'funded', 'servicing') THEN 1 END) as approved_count
      FROM applications
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month
    `);

    // Total funded amount
    const totalFunded = await db('loans').sum('principal_amount as total').first();

    // Average loan amount
    const avgLoan = await baseQuery.clone().avg('requested_amount as avg_amount').first();

    res.json({
      total_applications: parseInt(totalApps.count),
      approval_rate: approvalRate,
      avg_ltv: Math.round((parseFloat(avgLTV.avg_ltv) || 0) * 100) / 100,
      avg_time_to_fund_days: avgTimeToFund,
      total_funded_amount: parseFloat(totalFunded.total) || 0,
      avg_loan_amount: Math.round((parseFloat(avgLoan.avg_amount) || 0) * 100) / 100,
      by_status: byStatus,
      by_state: byState,
      by_branch: byBranch,
      by_product: byProduct,
      monthly_trend: monthlyTrend.rows || [],
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard' });
  }
});

/** GET /api/reporting/pipeline - Pipeline summary for loan officers / branch managers */
router.get('/pipeline', authenticate, async (req, res) => {
  try {
    let query = db('applications');

    if (req.user.role === 'loan_officer') {
      query = query.where('loan_officer_id', req.user.id);
    } else if (req.user.role === 'branch_manager') {
      query = query.where('branch_id', req.user.branch_id);
    }

    const pipeline = await query
      .select('status')
      .count('id as count')
      .sum('requested_amount as total_amount')
      .groupBy('status')
      .orderBy('count', 'desc');

    const total = pipeline.reduce((sum, p) => sum + parseInt(p.count), 0);
    const totalAmount = pipeline.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

    res.json({ pipeline, total, total_amount: totalAmount });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate pipeline' });
  }
});

/** GET /api/reporting/adverse-actions - Adverse action log for compliance */
router.get('/adverse-actions', authenticate, authorize('compliance_officer', 'system_admin', 'executive'), async (req, res) => {
  try {
    const adverseActions = await db('applications')
      .where('status', 'declined')
      .whereNotNull('adverse_action_notice')
      .leftJoin('users as borrower_user', function () {
        this.on('applications.borrower_id', '=', db.raw('(SELECT id FROM borrowers WHERE borrowers.id = applications.borrower_id)'));
      })
      .select('applications.id', 'applications.application_number', 'applications.state',
        'applications.decision_reasons', 'applications.adverse_action_notice',
        'applications.decision_at', 'applications.requested_amount')
      .orderBy('applications.decision_at', 'desc');

    res.json(adverseActions);
  } catch (error) {
    console.error('Adverse actions error:', error);
    res.status(500).json({ error: 'Failed to fetch adverse actions' });
  }
});

module.exports = router;
