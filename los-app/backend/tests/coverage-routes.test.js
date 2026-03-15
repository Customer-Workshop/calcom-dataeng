/**
 * Comprehensive route handler coverage tests.
 * Tests route handlers directly (no supertest) to avoid rate limiting issues.
 * Covers: auth, applications, admin, conditions, documents, collateral, reporting.
 */

// ── Chainable DB mock ───────────────────────────────────────────
let mockData = {};
let mockFirstData = {};
let mockInsertData = {};
let mockUpdateData = {};
let mockRawResult = { rows: [] };

function resetMocks() {
  mockData = {};
  mockFirstData = {};
  mockInsertData = {};
  mockUpdateData = {};
  mockRawResult = { rows: [] };
}

function setData(t, r) { mockData[t] = r; }
function setFirst(t, r) { mockFirstData[t] = r; }
function setInsert(t, r) { mockInsertData[t] = r; }
function setUpdate(t, r) { mockUpdateData[t] = r; }

function makeChain(table) {
  const c = {};
  c._table = table;
  c._isCount = false;
  c._isAvg = false;
  c._isSum = false;
  const methods = [
    'select','where','whereIn','whereNotIn','whereNotNull','whereNull',
    'leftJoin','join','orderBy','groupBy','limit','offset',
    'count','sum','avg','orWhere','on','having',
  ];
  for (const m of methods) {
    c[m] = jest.fn(function() {
      if (m === 'count') c._isCount = true;
      if (m === 'avg') c._isAvg = true;
      if (m === 'sum') c._isSum = true;
      // Handle .where(function() { this.where().orWhere() })
      if (m === 'where' && typeof arguments[0] === 'function') {
        const self = {};
        self.where = jest.fn().mockReturnValue(self);
        self.orWhere = jest.fn().mockReturnValue(self);
        self.on = jest.fn().mockReturnValue(self);
        try { arguments[0].call(self); } catch(e) {}
      }
      // Handle .leftJoin('t', function() { this.on() })
      if ((m === 'leftJoin' || m === 'join') && typeof arguments[1] === 'function') {
        const self = {};
        self.on = jest.fn().mockReturnValue(self);
        self.orWhere = jest.fn().mockReturnValue(self);
        try { arguments[1].call(self); } catch(e) {}
      }
      return c;
    });
  }
  c.clone = jest.fn(() => makeChain(table));
  c.first = jest.fn(() => {
    if (mockFirstData[table] !== undefined) return Promise.resolve(mockFirstData[table]);
    if (c._isCount) return Promise.resolve({ count: '0' });
    if (c._isAvg) return Promise.resolve({ avg_ltv: '38.5', avg_amount: '15000', avg_days: '5.2' });
    if (c._isSum) return Promise.resolve({ total: '150000' });
    return Promise.resolve(null);
  });
  c.insert = jest.fn((data) => {
    const result = mockInsertData[table] || [{ id: 1, ...data }];
    return { returning: jest.fn(() => Promise.resolve(result)) };
  });
  c.update = jest.fn((data) => {
    const result = mockUpdateData[table] || [{ id: 1, ...data }];
    return {
      returning: jest.fn(() => Promise.resolve(result)),
      then: (fn) => Promise.resolve(result).then(fn),
    };
  });
  c.del = jest.fn(() => Promise.resolve(1));
  c.returning = jest.fn(() => Promise.resolve(mockData[table] || []));
  c.then = function(resolve, reject) {
    return Promise.resolve(mockData[table] || []).then(resolve, reject);
  };
  c.catch = function(fn) {
    return Promise.resolve(mockData[table] || []).catch(fn);
  };
  return c;
}

const mockDb = jest.fn((table) => makeChain(table));
mockDb.raw = jest.fn(() => Promise.resolve(mockRawResult));
mockDb.destroy = jest.fn(() => Promise.resolve());

jest.mock('../src/config/database', () => ({
  db: mockDb,
  getPoolStats: jest.fn(() => ({ total: 50, used: 5, idle: 45 })),
}));

jest.mock('../src/utils/audit', () => ({
  createAuditLog: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/utils/notifications', () => ({
  sendNotification: jest.fn(() => Promise.resolve()),
  notifyStatusChange: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/utils/pdf', () => ({
  generateLoanAgreementPDF: jest.fn(() => Promise.resolve(Buffer.from('pdf'))),
  generateAdverseActionPDF: jest.fn(() => Promise.resolve(Buffer.from('pdf'))),
}));

jest.mock('../src/config/cache', () => ({
  getOrSet: jest.fn((k, fn) => fn()),
  invalidate: jest.fn(),
  invalidateAll: jest.fn(),
  getStats: jest.fn(() => ({ size: 3 })),
  getLoanProducts: jest.fn(() => Promise.resolve([{ id: 1, name: 'Personal Loan' }])),
  getBranches: jest.fn(() => Promise.resolve([{ id: 1, name: 'Dallas' }])),
  getRoles: jest.fn(() => Promise.resolve([{ id: 1, name: 'borrower' }])),
  getStateRules: jest.fn(() => Promise.resolve([{ id: 1, state: 'TX' }])),
  getStateRule: jest.fn(() => Promise.resolve({ id: 1, state: 'TX' })),
}));

jest.mock('../src/config/circuitBreaker', () => ({
  getAllBreakerStatus: jest.fn(() => []),
  creditBureauBreaker: { exec: jest.fn((fn) => fn()), getStatus: jest.fn(() => ({})) },
  identityCheckBreaker: { exec: jest.fn((fn) => fn()), getStatus: jest.fn(() => ({})) },
  collateralValuationBreaker: { exec: jest.fn((fn) => fn()), getStatus: jest.fn(() => ({})) },
}));

jest.mock('../src/services/creditService', () => ({
  softCreditPull: jest.fn(() => Promise.resolve({ score: 720, tradelines: [] })),
  hardCreditPull: jest.fn(() => Promise.resolve({ score: 740, tradelines: [] })),
}));

jest.mock('../src/services/identityService', () => ({
  runIdentityCheck: jest.fn(() => Promise.resolve({ ofac: { clear: true }, ssn: { valid: true } })),
}));

jest.mock('../src/services/decisioningService', () => ({
  runDecisionEngine: jest.fn(() => Promise.resolve({
    decision: 'auto_approve', status: 'approved',
    reasonCodes: ['CREDIT_SCORE_PASS'], metrics: { creditScore: 740, ltvRatio: 75, dtiRatio: 28 },
    approvedAmount: 15000, approvedRate: 8.99,
  })),
}));

jest.mock('../src/services/collateralService', () => ({
  upsertCollateral: jest.fn(() => Promise.resolve({ id: 1, estimated_value: 25000 })),
  lookupVehicleByVIN: jest.fn(() => ({ year: 2022, make: 'Toyota', model: 'Camry' })),
  calculateValuation: jest.fn(() => ({ estimated_value: 25000, confidence: 'high' })),
  calculateLTV: jest.fn(() => 75.5),
}));

jest.mock('../src/services/tilaService', () => ({
  calculateMonthlyPayment: jest.fn(() => 450.12),
  generateTILADisclosure: jest.fn(() => ({
    apr: 8.99, finance_charge: 3000, amount_financed: 15000,
    total_of_payments: 18000, monthly_payment: 500,
    payment_schedule: '36 monthly payments of $500',
  })),
}));

// Set high rate limits for testing
process.env.RATE_LIMIT_API = '99999';
process.env.RATE_LIMIT_AUTH = '99999';
process.env.RATE_LIMIT_SENSITIVE = '99999';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/index');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

function tok(payload, exp = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: exp });
}

// Generate fresh borrower tokens per-test to avoid blacklist contamination
function freshBorrowerTok() {
  return tok({ id: 1, email: `b${Date.now()}@t.com`, role: 'borrower', role_id: 1 });
}
const borrowerTok = tok({ id: 1, email: 'b@t.com', role: 'borrower', role_id: 1 });
const officerTok = tok({ id: 2, email: 'o@t.com', role: 'loan_officer', role_id: 2, branch_id: 1 });
const managerTok = tok({ id: 3, email: 'm@t.com', role: 'branch_manager', role_id: 3, branch_id: 1 });
const uwTok = tok({ id: 4, email: 'u@t.com', role: 'underwriter', role_id: 4 });
const compTok = tok({ id: 5, email: 'c@t.com', role: 'compliance_officer', role_id: 5 });
const adminTok = tok({ id: 6, email: 'a@t.com', role: 'system_admin', role_id: 6 });
const execTok = tok({ id: 7, email: 'e@t.com', role: 'executive', role_id: 7, branch_id: 1 });

function defaults() {
  resetMocks();
  setFirst('users', {
    id: 1, email: 'test@t.com',
    password_hash: '$2a$12$LJ3m4ys3Lk7bQFcCn0lxKOSgpmLjCslZIwV4bNmJN5WZqGIFsVAVi',
    role_id: 1, is_active: true, role_name: 'borrower', authority_limit: 0, branch_id: 1,
    first_name: 'Test', last_name: 'User', failed_login_attempts: 0, locked_until: null,
  });
  setFirst('roles', { id: 1, name: 'borrower', display_name: 'Borrower', authority_limit: 0 });
  setFirst('applications', {
    id: 1, application_number: 'APP-001', borrower_id: 1, loan_product_id: 1,
    requested_amount: 15000, term_months: 36, status: 'submitted', state: 'TX',
    approved_amount: 15000, interest_rate: 8.99, loan_officer_id: 2, branch_id: 1, ltv_ratio: 75,
  });
  setFirst('borrowers', { id: 1, user_id: 1, ssn_last_four: '1234', annual_income: '72000', monthly_debt_payments: '850' });
  setFirst('loan_products', { id: 1, name: 'Personal Loan', type: 'personal', requires_collateral: false });
  setFirst('collateral', { id: 1, application_id: 1, estimated_value: 25000, photo_urls: '[]' });
  setFirst('credit_reports', { id: 1, application_id: 1, score: 740 });
  setFirst('state_rules', { id: 1, state: 'TX', is_enabled: true, max_rate_cap: 18 });
  setFirst('branches', { id: 1, name: 'Dallas', state: 'TX' });
  setFirst('conditions', { count: '0' });
  setFirst('loans', { id: 1, loan_number: 'LN-2026-001', application_id: 1, principal_amount: 15000 });

  setData('applications', [{ id: 1, application_number: 'APP-001', status: 'submitted', count: '1', total_amount: '15000' }]);
  setData('conditions', []);
  setData('documents', []);
  setData('collateral', [{ id: 1, application_id: 1 }]);
  setData('valuations', []);
  setData('users', [{ id: 1, email: 'test@t.com', first_name: 'Test', last_name: 'User' }]);
  setData('audit_logs', [{ id: 1, action: 'test', created_at: new Date() }]);
  setData('credit_reports', []);
  setData('decisions', []);
  setData('loans', [{ id: 1, principal_amount: 15000 }]);
}

beforeEach(() => {
  defaults();
  jest.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Auth Routes', () => {
  test('POST /api/auth/register - password too weak', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com', password: 'weak', first_name: 'A', last_name: 'B',
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register - success', async () => {
    setFirst('users', null);
    setFirst('roles', { id: 1, name: 'borrower' });
    setInsert('users', [{ id: 99, email: 'new@test.com', first_name: 'New', last_name: 'User', role_id: 1 }]);
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@test.com', password: 'SecureP@ss1234', first_name: 'New', last_name: 'User',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/register - duplicate email', async () => {
    setFirst('users', { id: 1, email: 'exist@test.com' });
    const res = await request(app).post('/api/auth/register').send({
      email: 'exist@test.com', password: 'SecureP@ss1234', first_name: 'A', last_name: 'B',
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/login - validation fails', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login - user not found', async () => {
    setFirst('users', null);
    const res = await request(app).post('/api/auth/login').send({
      email: 'nobody@test.com', password: 'SomeP@ss1234',
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login - wrong password', async () => {
    // password_hash is bcrypt hash of 'SecureP@ss1234'
    setFirst('users', {
      id: 1, email: 'b@t.com',
      password_hash: '$2a$12$LJ3m4ys3Lk7bQFcCn0lxKOSgpmLjCslZIwV4bNmJN5WZqGIFsVAVi',
      is_active: true, role_name: 'borrower', role_id: 1, authority_limit: 0,
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'b@t.com', password: 'WrongP@ssword1',
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/logout - success', async () => {
    // Use a unique token so it doesn't blacklist the shared borrowerTok
    const logoutTok = tok({ id: 99, email: 'logout@t.com', role: 'borrower', role_id: 1 });
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${logoutTok}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/logged out/i);
  });

  test('POST /api/auth/refresh - success', async () => {
    setFirst('users', {
      id: 1, email: 'b@t.com', is_active: true, role_name: 'borrower',
      role_id: 1, branch_id: 1, authority_limit: 0,
    });
    const freshTok = freshBorrowerTok();
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${freshTok}`);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('POST /api/auth/refresh - user not found', async () => {
    setFirst('users', null);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Authorization', `Bearer ${borrowerTok}`);
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/change-password - missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/change-password - weak new password', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`)
      .send({ current_password: 'OldP@ss12345', new_password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/change-password - user not found', async () => {
    setFirst('users', null);
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`)
      .send({ current_password: 'OldP@ss12345', new_password: 'NewSecure@1234' });
    expect(res.status).toBe(404);
  });

  test('GET /api/auth/me - success', async () => {
    setFirst('users', {
      id: 1, email: 'b@t.com', first_name: 'Test', last_name: 'User',
      role: 'borrower', role_display: 'Borrower', is_active: true,
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/auth/me - not found', async () => {
    setFirst('users', null);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════
// APPLICATION ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Application Routes', () => {
  test('GET /api/applications - borrower with borrower record', async () => {
    setFirst('borrowers', { id: 1, user_id: 1 });
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/applications - borrower no borrower record', async () => {
    setFirst('borrowers', null);
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('GET /api/applications - loan officer', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/applications - branch manager', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${managerTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/applications - underwriter', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${uwTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/applications - with filters', async () => {
    const res = await request(app)
      .get('/api/applications?search=Smith&status=submitted&branch_id=1&loan_officer_id=2')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/applications/:id - found', async () => {
    const res = await request(app)
      .get('/api/applications/1')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/applications/:id - with encrypted SSN covers maskBorrowerPII decrypt branch', async () => {
    // Provide an encrypted SSN to trigger the isEncrypted→decrypt branch (lines 54-55)
    const { encrypt } = require('../src/utils/encryption');
    const encSSN = encrypt('5678');
    setFirst('applications', {
      id: 1, application_number: 'APP-001', borrower_id: 1, loan_product_id: 1,
      requested_amount: 15000, term_months: 36, status: 'submitted', state: 'TX',
      ssn_last_four: encSSN, annual_income: '72000', monthly_debt_payments: '850',
    });
    const res = await request(app)
      .get('/api/applications/1')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    // Response spreads application fields at top level
    expect(res.body.ssn_last_four_masked).toBe('****5678');
  });

  test('GET /api/applications/:id - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .get('/api/applications/999')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/applications - new borrower', async () => {
    setFirst('borrowers', null);
    setInsert('borrowers', [{ id: 1 }]);
    setFirst('branches', { id: 1 });
    setFirst('roles', { id: 2, name: 'loan_officer' });
    setData('users', [{ id: 2, role_id: 2, branch_id: 1, is_active: true }]);
    setInsert('applications', [{ id: 1, application_number: 'APP-NEW', status: 'submitted' }]);
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ loan_product_id: 1, requested_amount: 15000, term_months: 36, purpose: 'Debt', state: 'TX' });
    expect(res.status).toBe(201);
  });

  test('POST /api/applications - existing borrower with info', async () => {
    setFirst('borrowers', { id: 1, user_id: 1 });
    setUpdate('borrowers', [{ id: 1 }]);
    setFirst('branches', { id: 1 });
    setFirst('roles', { id: 2, name: 'loan_officer' });
    setData('users', [{ id: 2, role_id: 2, branch_id: 1, is_active: true }]);
    setInsert('applications', [{ id: 2, application_number: 'APP-002', status: 'submitted' }]);
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({
        loan_product_id: 1, requested_amount: 20000, term_months: 48,
        purpose: 'Auto', state: 'FL',
        borrower_info: { ssn_last_four: '5678', annual_income: 85000, monthly_debt_payments: 600 },
      });
    expect(res.status).toBe(201);
  });

  test('PUT /api/applications/:id - success', async () => {
    setUpdate('applications', [{ id: 1, requested_amount: 18000 }]);
    const res = await request(app)
      .put('/api/applications/1')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ requested_amount: 18000 });
    expect(res.status).toBe(200);
  });

  test('POST /api/applications/:id/pre-qualify - success', async () => {
    const res = await request(app)
      .post('/api/applications/1/pre-qualify')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pre_qualified');
  });

  test('POST /api/applications/:id/pre-qualify - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/pre-qualify')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/credit-pull - success', async () => {
    const res = await request(app)
      .post('/api/applications/1/credit-pull')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.credit_report).toBeDefined();
  });

  test('POST /api/applications/:id/credit-pull - borrower rejected', async () => {
    const res = await request(app)
      .post('/api/applications/1/credit-pull')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(403);
  });

  test('POST /api/applications/:id/credit-pull - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/credit-pull')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/identity-check - success', async () => {
    const res = await request(app)
      .post('/api/applications/1/identity-check')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/applications/:id/verify-income - success', async () => {
    const res = await request(app)
      .post('/api/applications/1/verify-income')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('income_verified');
  });

  test('POST /api/applications/:id/verify-income - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/verify-income')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/decision - success', async () => {
    const res = await request(app)
      .post('/api/applications/1/decision')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('auto_approve');
  });

  test('POST /api/applications/:id/manual-decision - approve', async () => {
    setFirst('applications', { id: 1, application_number: 'APP-001', requested_amount: 15000, status: 'underwriting' });
    setInsert('decisions', [{ id: 1, decision_type: 'manual_approve' }]);
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ decision_type: 'manual_approve', approved_amount: 15000, approved_rate: 8.99 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  test('POST /api/applications/:id/manual-decision - decline', async () => {
    setFirst('applications', { id: 1, application_number: 'APP-001', requested_amount: 15000, status: 'underwriting' });
    setInsert('decisions', [{ id: 1, decision_type: 'manual_decline' }]);
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ decision_type: 'manual_decline', reason_codes: ['HIGH_DTI'] });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('declined');
  });

  test('POST /api/applications/:id/manual-decision - counter_offer', async () => {
    setFirst('applications', { id: 1, application_number: 'APP-001', requested_amount: 15000, status: 'underwriting' });
    setInsert('decisions', [{ id: 1, decision_type: 'counter_offer' }]);
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ decision_type: 'counter_offer', approved_amount: 10000, approved_rate: 12.99 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('counter_offered');
  });

  test('POST /api/applications/:id/manual-decision - refer', async () => {
    setFirst('applications', { id: 1, application_number: 'APP-001', status: 'underwriting' });
    setInsert('decisions', [{ id: 1, decision_type: 'refer' }]);
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ decision_type: 'refer' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('underwriting');
  });

  test('POST /api/applications/:id/manual-decision - with conditions list', async () => {
    setFirst('applications', { id: 1, application_number: 'APP-001', requested_amount: 15000, status: 'underwriting' });
    setInsert('decisions', [{ id: 1, decision_type: 'manual_approve' }]);
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({
        decision_type: 'manual_approve', approved_amount: 15000, approved_rate: 9.99,
        conditions: ['Proof of income', 'Additional docs'],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('conditionally_approved');
  });

  test('POST /api/applications/:id/manual-decision - exceeds authority', async () => {
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ decision_type: 'manual_approve', approved_amount: 9999999, approved_rate: 8.99 });
    expect(res.status).toBe(403);
  });

  test('POST /api/applications/:id/counter-offer-response - accept', async () => {
    setFirst('applications', { id: 1, status: 'counter_offered' });
    const res = await request(app)
      .post('/api/applications/1/counter-offer-response')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ accept: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  test('POST /api/applications/:id/counter-offer-response - reject', async () => {
    setFirst('applications', { id: 1, status: 'counter_offered' });
    const res = await request(app)
      .post('/api/applications/1/counter-offer-response')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ accept: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('withdrawn');
  });

  test('POST /api/applications/:id/counter-offer-response - wrong status', async () => {
    setFirst('applications', { id: 1, status: 'submitted' });
    const res = await request(app)
      .post('/api/applications/1/counter-offer-response')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ accept: true });
    expect(res.status).toBe(400);
  });

  test('POST /api/applications/:id/counter-offer-response - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/counter-offer-response')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ accept: true });
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/e-sign - approved app', async () => {
    setFirst('applications', { id: 1, status: 'approved', borrower_id: 1, approved_amount: 15000, interest_rate: 8.99, term_months: 36 });
    setFirst('borrowers', { id: 1 });
    setInsert('e_signatures', [{ id: 1, status: 'signed' }]);
    const res = await request(app)
      .post('/api/applications/1/e-sign')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ signature_data: 'base64sig', signer_name: 'John Doe' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('e_signed');
  });

  test('POST /api/applications/:id/e-sign - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/e-sign')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ signature_data: 'base64sig', signer_name: 'John Doe' });
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/e-sign - conditions pending', async () => {
    setFirst('applications', { id: 1, status: 'pending_conditions', borrower_id: 1 });
    // The status is not in ['approved', 'conditionally_approved'] so it will check conditions
    // Mock the conditions count query to return pending conditions
    setFirst('conditions', { count: '2' });
    const res = await request(app)
      .post('/api/applications/1/e-sign')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ signature_data: 'base64sig', signer_name: 'John Doe' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/conditions/i);
  });

  test('POST /api/applications/:id/fund - success', async () => {
    setFirst('applications', { id: 1, status: 'e_signed', borrower_id: 1, approved_amount: 15000, interest_rate: 8.99, term_months: 36 });
    setInsert('loans', [{ id: 1, loan_number: 'LN-2026-001' }]);
    setInsert('funding_instructions', [{ id: 1, status: 'authorized' }]);
    const res = await request(app)
      .post('/api/applications/1/fund')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.loan).toBeDefined();
  });

  test('POST /api/applications/:id/fund - wrong status', async () => {
    setFirst('applications', { id: 1, status: 'submitted' });
    const res = await request(app)
      .post('/api/applications/1/fund')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(400);
  });

  test('POST /api/applications/:id/fund - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/fund')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/handoff - success with documents', async () => {
    setFirst('applications', { id: 1, borrower_id: 1, status: 'funded' });
    setFirst('loans', { id: 1, loan_number: 'LN-001' });
    setFirst('borrowers', { id: 1 });
    setData('collateral', [{ id: 1, vin: 'ABC123' }]);
    setData('documents', [
      { id: 1, name: 'pay_stub.pdf', category: 'income' },
      { id: 2, name: 'id_front.jpg', category: 'identity' },
    ]);
    setData('conditions', [{ id: 1, description: 'Verify income' }]);
    const res = await request(app)
      .post('/api/applications/1/handoff')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.servicing_package).toBeDefined();
  });

  test('POST /api/applications/:id/handoff - not found', async () => {
    setFirst('applications', null);
    const res = await request(app)
      .post('/api/applications/1/handoff')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/applications/:id/handoff - no loan', async () => {
    setFirst('applications', { id: 1, borrower_id: 1, status: 'funded' });
    setFirst('loans', null);
    setFirst('borrowers', { id: 1 });
    setData('collateral', []);
    setData('documents', []);
    setData('conditions', []);
    const res = await request(app)
      .post('/api/applications/1/handoff')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/applications/:id/reassign - success', async () => {
    setUpdate('applications', [{ id: 1, loan_officer_id: 5 }]);
    const res = await request(app)
      .post('/api/applications/1/reassign')
      .set('Authorization', `Bearer ${managerTok}`)
      .send({ loan_officer_id: 5 });
    expect(res.status).toBe(200);
  });

  test('POST /api/applications/:id/reassign - borrower rejected', async () => {
    const res = await request(app)
      .post('/api/applications/1/reassign')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`)
      .send({ loan_officer_id: 5 });
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Admin Routes', () => {
  test('GET /api/admin/users - non-admin rejected', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/admin/users - admin success', async () => {
    setData('users', [{ id: 1, email: 'test@t.com' }]);
    setFirst('users', { count: '1' });
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/users - with filters', async () => {
    setData('users', []);
    setFirst('users', { count: '0' });
    const res = await request(app)
      .get('/api/admin/users?role=borrower&branch_id=1&search=John')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/admin/users - success', async () => {
    setFirst('users', null);
    setInsert('users', [{ id: 99, email: 'new@t.com', first_name: 'New', last_name: 'User', role_id: 1 }]);
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({
        email: 'new@t.com', password: 'SecureP@ss1234',
        first_name: 'New', last_name: 'User', role_id: 1,
      });
    expect(res.status).toBe(201);
  });

  test('POST /api/admin/users - duplicate', async () => {
    setFirst('users', { id: 1, email: 'exist@t.com' });
    const res = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({
        email: 'exist@t.com', password: 'SecureP@ss1234',
        first_name: 'A', last_name: 'B', role_id: 1,
      });
    expect(res.status).toBe(409);
  });

  test('PUT /api/admin/users/:id - success', async () => {
    setUpdate('users', [{ id: 1, first_name: 'Updated' }]);
    const res = await request(app)
      .put('/api/admin/users/1')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ first_name: 'Updated', is_active: true });
    expect(res.status).toBe(200);
  });

  test('PUT /api/admin/users/:id - with password', async () => {
    setUpdate('users', [{ id: 1 }]);
    const res = await request(app)
      .put('/api/admin/users/1')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ password: 'NewSecureP@ss1234' });
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/roles - success', async () => {
    const res = await request(app)
      .get('/api/admin/roles')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/branches - success', async () => {
    const res = await request(app)
      .get('/api/admin/branches')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/admin/branches - success', async () => {
    setInsert('branches', [{ id: 2, name: 'New Branch' }]);
    const res = await request(app)
      .post('/api/admin/branches')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: 'New Branch', state: 'FL' });
    expect(res.status).toBe(201);
  });

  test('GET /api/admin/loan-products - success', async () => {
    const res = await request(app)
      .get('/api/admin/loan-products')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('PUT /api/admin/loan-products/:id - success', async () => {
    setUpdate('loan_products', [{ id: 1, name: 'Updated' }]);
    const res = await request(app)
      .put('/api/admin/loan-products/1')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/state-rules - success', async () => {
    const res = await request(app)
      .get('/api/admin/state-rules')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('PUT /api/admin/state-rules/:id - compliance', async () => {
    setUpdate('state_rules', [{ id: 1, state: 'TX' }]);
    const res = await request(app)
      .put('/api/admin/state-rules/1')
      .set('Authorization', `Bearer ${compTok}`)
      .send({ max_rate_cap: 20 });
    expect(res.status).toBe(200);
  });

  test('POST /api/admin/state-rules - success', async () => {
    setInsert('state_rules', [{ id: 2, state: 'CA' }]);
    const res = await request(app)
      .post('/api/admin/state-rules')
      .set('Authorization', `Bearer ${compTok}`)
      .send({ state: 'CA', state_name: 'California', is_enabled: true });
    expect(res.status).toBe(201);
  });

  test('GET /api/admin/audit-logs - success', async () => {
    setData('audit_logs', [{ id: 1, action: 'test' }]);
    setFirst('audit_logs', { count: '1' });
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${compTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/audit-logs - with filters', async () => {
    setData('audit_logs', []);
    setFirst('audit_logs', { count: '0' });
    const res = await request(app)
      .get('/api/admin/audit-logs?entity_type=application&action=created&user_id=1')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════
// CONDITIONS ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Conditions Routes', () => {
  test('GET /api/conditions/:appId - list', async () => {
    setData('conditions', [{ id: 1, name: 'Proof', status: 'pending' }]);
    const res = await request(app)
      .get('/api/conditions/1')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/conditions/:appId - create', async () => {
    setInsert('conditions', [{ id: 1, name: 'Proof', status: 'pending' }]);
    const res = await request(app)
      .post('/api/conditions/1')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ name: 'Proof of income', category: 'prior_to_funding' });
    expect(res.status).toBe(201);
  });

  test('POST /api/conditions/:appId - validation fails', async () => {
    const res = await request(app)
      .post('/api/conditions/1')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('PUT /api/conditions/clear/:id - all cleared', async () => {
    setUpdate('conditions', [{ id: 1, status: 'cleared', application_id: 1 }]);
    setFirst('conditions', { count: '0' });
    const res = await request(app)
      .put('/api/conditions/clear/1')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ notes: 'Verified' });
    expect(res.status).toBe(200);
    expect(res.body.all_conditions_cleared).toBe(true);
  });

  test('PUT /api/conditions/clear/:id - not all cleared', async () => {
    setUpdate('conditions', [{ id: 1, status: 'cleared', application_id: 1 }]);
    setFirst('conditions', { count: '2' });
    const res = await request(app)
      .put('/api/conditions/clear/1')
      .set('Authorization', `Bearer ${uwTok}`);
    expect(res.status).toBe(200);
    expect(res.body.all_conditions_cleared).toBe(false);
  });

  test('PUT /api/conditions/waive/:id - success', async () => {
    setUpdate('conditions', [{ id: 1, status: 'waived', application_id: 1 }]);
    const res = await request(app)
      .put('/api/conditions/waive/1')
      .set('Authorization', `Bearer ${uwTok}`)
      .send({ notes: 'Exception' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/conditions/waive/:id - borrower denied', async () => {
    const res = await request(app)
      .put('/api/conditions/waive/1')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════
// DOCUMENTS ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Documents Routes', () => {
  test('GET /api/documents/:appId - list', async () => {
    setData('documents', [{ id: 1, name: 'W2.pdf' }]);
    const res = await request(app)
      .get('/api/documents/1')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('POST /api/documents/:appId - upload', async () => {
    setInsert('documents', [{ id: 1, name: 'Untitled', status: 'uploaded' }]);
    const res = await request(app)
      .post('/api/documents/1')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ name: 'W2 Form', category: 'income' });
    expect(res.status).toBe(201);
  });

  test('PUT /api/documents/:id/review - success', async () => {
    setUpdate('documents', [{ id: 1, status: 'accepted' }]);
    const res = await request(app)
      .put('/api/documents/1/review')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ status: 'accepted', notes: 'Good' });
    expect(res.status).toBe(200);
  });

  test('PUT /api/documents/:id/review - invalid status', async () => {
    const res = await request(app)
      .put('/api/documents/1/review')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
  });

  test('PUT /api/documents/:id/review - borrower denied', async () => {
    const res = await request(app)
      .put('/api/documents/1/review')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`)
      .send({ status: 'accepted' });
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════
// COLLATERAL ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Collateral Routes', () => {
  test('GET /api/collateral/:appId - list', async () => {
    setData('collateral', [{ id: 1, application_id: 1 }]);
    setData('valuations', [{ id: 1, collateral_id: 1, estimated_value: 25000 }]);
    const res = await request(app)
      .get('/api/collateral/1')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.collateral).toBeDefined();
  });

  test('POST /api/collateral/:appId - create', async () => {
    setFirst('applications', { id: 1, requested_amount: 15000 });
    const res = await request(app)
      .post('/api/collateral/1')
      .set('Authorization', `Bearer ${officerTok}`)
      .send({ type: 'vehicle', vin: '1HGBH41JXMN100001', year: 2022, condition: 'good' });
    expect(res.status).toBe(201);
  });

  test('GET /api/collateral/vin-lookup/:vin - success', async () => {
    const res = await request(app)
      .get('/api/collateral/vin-lookup/1HGBH41JXMN100001?condition=good&mileage=30000')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2022);
  });

  test('POST /api/collateral/:id/photos - success', async () => {
    setFirst('collateral', { id: 1, photo_urls: '["old.jpg"]' });
    const res = await request(app)
      .post('/api/collateral/1/photos')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.photo_urls.length).toBe(2);
  });

  test('POST /api/collateral/:id/photos - not found', async () => {
    setFirst('collateral', null);
    const res = await request(app)
      .post('/api/collateral/1/photos')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(404);
  });

  test('POST /api/collateral/:id/photos - null urls', async () => {
    setFirst('collateral', { id: 1, photo_urls: null });
    const res = await request(app)
      .post('/api/collateral/1/photos')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
    expect(res.body.photo_urls.length).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// REPORTING ROUTES
// ══════════════════════════════════════════════════════════════════

describe('Reporting Routes', () => {
  test('GET /api/reporting/dashboard - executive', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard')
      .set('Authorization', `Bearer ${execTok}`);
    expect(res.status).toBe(200);
    expect(res.body.total_applications).toBeDefined();
  });

  test('GET /api/reporting/dashboard - with filters', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard?start_date=2025-01-01&end_date=2025-12-31&branch_id=1')
      .set('Authorization', `Bearer ${execTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/reporting/dashboard - branch manager auto-filter', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard')
      .set('Authorization', `Bearer ${managerTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/reporting/dashboard - borrower denied', async () => {
    const res = await request(app)
      .get('/api/reporting/dashboard')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/reporting/pipeline - officer', async () => {
    setData('applications', [{ status: 'submitted', count: 3, total_amount: 45000 }]);
    const res = await request(app)
      .get('/api/reporting/pipeline')
      .set('Authorization', `Bearer ${officerTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/reporting/pipeline - branch manager', async () => {
    const res = await request(app)
      .get('/api/reporting/pipeline')
      .set('Authorization', `Bearer ${managerTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/reporting/pipeline - admin (no filter)', async () => {
    const res = await request(app)
      .get('/api/reporting/pipeline')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/reporting/adverse-actions - compliance', async () => {
    setData('applications', [{ id: 1, status: 'declined' }]);
    const res = await request(app)
      .get('/api/reporting/adverse-actions')
      .set('Authorization', `Bearer ${compTok}`);
    expect(res.status).toBe(200);
  });

  test('GET /api/reporting/adverse-actions - borrower denied', async () => {
    const res = await request(app)
      .get('/api/reporting/adverse-actions')
      .set('Authorization', `Bearer ${freshBorrowerTok()}`);
    expect(res.status).toBe(403);
  });
});

// ══════════════════════════════════════════════════════════════════
// HEALTH ENDPOINTS
// ══════════════════════════════════════════════════════════════════

describe('Health Endpoints', () => {
  test('GET /api/health/live - alive', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  test('GET /api/health/ready - ready', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  test('GET /api/health - detailed', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBeDefined();
  });

  test('security headers present', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE (integration)
// ══════════════════════════════════════════════════════════════════

describe('Auth Middleware Integration', () => {
  test('rejects unauthenticated', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  test('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });

  test('rejects expired token', async () => {
    const expired = tok({ id: 1, email: 'x@t.com', role: 'borrower' }, '-1s');
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('rejects blacklisted token', async () => {
    const { blacklistToken, clearBlacklist } = require('../src/utils/tokenBlacklist');
    const token = tok({ id: 99, email: 'bl@t.com', role: 'borrower' });
    const decoded = jwt.decode(token);
    blacklistToken(token, decoded.exp);
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/revoked/i);
    clearBlacklist();
  });

  test('404 for unknown route', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
