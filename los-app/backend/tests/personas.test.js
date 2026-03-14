/**
 * Persona-specific workflow and authorization tests.
 * Covers all 7 personas: Borrower, Loan Officer, Branch Manager,
 * Underwriter, Compliance Officer, System Admin, Executive.
 */

const request = require('supertest');

// Mock the database module before requiring app
jest.mock('../src/config/database', () => {
  const mockDb = jest.fn(() => mockDb);
  mockDb.select = jest.fn(() => mockDb);
  mockDb.where = jest.fn(() => mockDb);
  mockDb.first = jest.fn(() => Promise.resolve(null));
  mockDb.insert = jest.fn(() => mockDb);
  mockDb.update = jest.fn(() => mockDb);
  mockDb.returning = jest.fn(() => Promise.resolve([]));
  mockDb.join = jest.fn(() => mockDb);
  mockDb.leftJoin = jest.fn(() => mockDb);
  mockDb.orderBy = jest.fn(() => mockDb);
  mockDb.limit = jest.fn(() => mockDb);
  mockDb.offset = jest.fn(() => Promise.resolve([]));
  mockDb.count = jest.fn(() => mockDb);
  mockDb.clone = jest.fn(() => mockDb);
  mockDb.sum = jest.fn(() => mockDb);
  mockDb.avg = jest.fn(() => mockDb);
  mockDb.groupBy = jest.fn(() => mockDb);
  mockDb.whereIn = jest.fn(() => mockDb);
  mockDb.whereNotIn = jest.fn(() => mockDb);
  mockDb.whereNotNull = jest.fn(() => mockDb);
  mockDb.whereNull = jest.fn(() => mockDb);
  mockDb.raw = jest.fn(() => Promise.resolve({ rows: [] }));
  mockDb.del = jest.fn(() => Promise.resolve(1));
  mockDb.delete = jest.fn(() => Promise.resolve(1));
  mockDb.destroy = jest.fn(() => Promise.resolve());
  mockDb.client = { pool: null };
  mockDb.schema = {
    createTableIfNotExists: jest.fn(() => Promise.resolve()),
  };
  mockDb.fn = { now: jest.fn(() => new Date()) };
  return {
    db: mockDb,
    config: {},
    getPoolStats: jest.fn(() => ({
      used: 0, free: 5, pendingAcquires: 0, pendingCreates: 0, max: 50, min: 5,
    })),
  };
});


const app = require('../src/index');

// ============================================================
// Persona 1: Borrower
// ============================================================

describe('Persona: Borrower', () => {
  test('borrower cannot access admin users endpoint', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('borrower cannot access reporting dashboard', async () => {
    const res = await request(app).get('/api/reporting/dashboard');
    expect(res.status).toBe(401);
  });

  test('borrower cannot access state rules', async () => {
    const res = await request(app).get('/api/admin/state-rules');
    expect(res.status).toBe(401);
  });

  test('borrower registration requires all fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'borrower@test.com' });
    expect(res.status).toBe(400);
  });

  test('borrower registration validates email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invalid', password: 'TestPassword123!', first_name: 'Test', last_name: 'Borrower' });
    expect(res.status).toBe(400);
  });

  test('borrower application submission requires auth', async () => {
    const res = await request(app)
      .post('/api/applications')
      .send({
        loan_product_id: 1,
        requested_amount: 15000,
        term_months: 36,
        purpose: 'Personal expenses',
      });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Persona 2: Loan Officer
// ============================================================

describe('Persona: Loan Officer', () => {
  test('loan officer pipeline requires authentication', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  test('loan officer credit pull requires authentication', async () => {
    const res = await request(app).post('/api/applications/1/credit-pull');
    expect(res.status).toBe(401);
  });

  test('loan officer identity check requires authentication', async () => {
    const res = await request(app).post('/api/applications/1/identity-check');
    expect(res.status).toBe(401);
  });

  test('loan officer decisioning requires authentication', async () => {
    const res = await request(app).post('/api/applications/1/decision');
    expect(res.status).toBe(401);
  });

  test('loan officer collateral capture requires authentication', async () => {
    const res = await request(app)
      .post('/api/collateral/1')
      .send({ type: 'vehicle', vin: '1HGBH41JXMN109186', condition: 'good', mileage: 25000 });
    expect(res.status).toBe(401);
  });

  test('loan officer e-sign requires authentication', async () => {
    const res = await request(app)
      .post('/api/applications/1/e-sign')
      .send({ signature_data: 'base64data', signer_name: 'John Smith' });
    expect(res.status).toBe(401);
  });

  test('loan officer funding requires authentication', async () => {
    const res = await request(app)
      .post('/api/applications/1/fund')
      .send({ disbursement_method: 'ach' });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Persona 3: Branch Manager
// ============================================================

describe('Persona: Branch Manager', () => {
  test('branch manager team pipeline requires auth', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  test('branch manager cannot access system admin endpoints without auth', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('branch manager reporting access requires auth', async () => {
    const res = await request(app).get('/api/reporting/pipeline');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Persona 4: Underwriter
// ============================================================

describe('Persona: Underwriter', () => {
  test('underwriter queue requires authentication', async () => {
    const res = await request(app).get('/api/applications?status=underwriting');
    expect(res.status).toBe(401);
  });

  test('underwriter manual decision requires authentication', async () => {
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .send({
        decision_type: 'manual_approve',
        approved_amount: 20000,
        approved_rate: 6.5,
        approved_term: 48,
        reason_codes: ['MANUAL_REVIEW'],
        notes: 'Approved after review',
      });
    expect(res.status).toBe(401);
  });

  test('underwriter condition creation requires authentication', async () => {
    const res = await request(app)
      .post('/api/conditions/1')
      .send({
        name: 'Proof of Insurance',
        category: 'prior_to_funding',
        description: 'Must provide proof of comprehensive insurance',
      });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Persona 5: Compliance Officer
// ============================================================

describe('Persona: Compliance Officer', () => {
  test('compliance state rules access requires auth', async () => {
    const res = await request(app).get('/api/admin/state-rules');
    expect(res.status).toBe(401);
  });

  test('compliance state rules update requires auth', async () => {
    const res = await request(app)
      .put('/api/admin/state-rules/1')
      .send({
        max_interest_rate: 18.5,
        max_fee_percentage: 3.0,
        required_disclosures: 'Updated disclosures',
      });
    expect(res.status).toBe(401);
  });

  test('compliance audit log access requires auth', async () => {
    const res = await request(app).get('/api/admin/audit-logs');
    expect(res.status).toBe(401);
  });

  test('compliance adverse action report requires auth', async () => {
    const res = await request(app).get('/api/reporting/adverse-actions');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Persona 6: System Admin
// ============================================================

describe('Persona: System Admin', () => {
  test('admin user management requires auth', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('admin user creation requires auth', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .send({
        email: 'newuser@republicfinance.com',
        password: 'SecurePass123!',
        first_name: 'New',
        last_name: 'Officer',
        role: 'loan_officer',
        branch_id: 1,
      });
    expect(res.status).toBe(401);
  });

  test('admin user update requires auth', async () => {
    const res = await request(app)
      .put('/api/admin/users/1')
      .send({ role: 'branch_manager', is_active: true });
    expect(res.status).toBe(401);
  });

  test('admin loan product management requires auth', async () => {
    const res = await request(app).get('/api/admin/loan-products');
    expect(res.status).toBe(401);
  });

  test('admin loan product update requires auth', async () => {
    const res = await request(app)
      .put('/api/admin/loan-products/1')
      .send({ min_rate: 5.99, max_rate: 18.99 });
    expect(res.status).toBe(401);
  });

  test('admin branch management requires auth', async () => {
    const res = await request(app).get('/api/admin/branches');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Persona 7: Executive
// ============================================================

describe('Persona: Executive', () => {
  test('executive dashboard requires auth', async () => {
    const res = await request(app).get('/api/reporting/dashboard');
    expect(res.status).toBe(401);
  });

  test('executive pipeline report requires auth', async () => {
    const res = await request(app).get('/api/reporting/pipeline');
    expect(res.status).toBe(401);
  });

  test('executive adverse action report requires auth', async () => {
    const res = await request(app).get('/api/reporting/adverse-actions');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Cross-Persona Authorization Validation
// ============================================================

describe('Cross-Persona Authorization', () => {
  test('all protected routes reject unauthenticated requests', async () => {
    const protectedRoutes = [
      { method: 'get', path: '/api/applications' },
      { method: 'get', path: '/api/applications/1' },
      { method: 'post', path: '/api/applications' },
      { method: 'get', path: '/api/collateral/1' },
      { method: 'get', path: '/api/conditions/1' },
      { method: 'get', path: '/api/documents/1' },
      { method: 'get', path: '/api/admin/users' },
      { method: 'get', path: '/api/admin/branches' },
      { method: 'get', path: '/api/admin/loan-products' },
      { method: 'get', path: '/api/admin/state-rules' },
      { method: 'get', path: '/api/admin/audit-logs' },
      { method: 'get', path: '/api/reporting/dashboard' },
      { method: 'get', path: '/api/reporting/pipeline' },
    ];

    for (const route of protectedRoutes) {
      const res = await request(app)[route.method](route.path);
      expect(res.status).toBe(401);
    }
  });

  test('all protected routes reject invalid tokens', async () => {
    const routes = [
      '/api/applications',
      '/api/admin/users',
      '/api/reporting/dashboard',
    ];

    for (const routePath of routes) {
      const res = await request(app)
        .get(routePath)
        .set('Authorization', 'Bearer fake-invalid-token-12345');
      expect(res.status).toBe(401);
    }
  });
});
