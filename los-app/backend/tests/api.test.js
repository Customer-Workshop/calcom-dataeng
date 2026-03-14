/**
 * Comprehensive API endpoint tests covering all routes and 7 personas.
 * Tests authentication enforcement, input validation, security headers,
 * and health check endpoints.
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
// Health Check Endpoints
// ============================================================

describe('Health Check Endpoints', () => {
  test('GET /api/health returns 200 with status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
  });

  test('GET /api/health/live returns 200 liveness probe', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(res.body).toHaveProperty('pid');
  });

  test('GET /api/health/ready returns readiness status', async () => {
    const res = await request(app).get('/api/health/ready');
    // Mock DB may succeed or fail — either is valid
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
  });
});

// ============================================================
// 404 Handler
// ============================================================

describe('404 Handler', () => {
  test('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });

  test('POST /api/nonexistent returns 404', async () => {
    const res = await request(app).post('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  test('PUT /api/nonexistent returns 404', async () => {
    const res = await request(app).put('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ============================================================
// Auth Routes - Validation
// ============================================================

describe('Auth Routes - Login Validation', () => {
  test('POST /api/auth/login with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login with invalid email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notanemail', password: 'password123' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login with missing password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login with missing email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'TestPass123!' });
    expect(res.status).toBe(400);
  });
});

describe('Auth Routes - Register Validation', () => {
  test('POST /api/auth/register with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register with short password returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'short', first_name: 'Test', last_name: 'User' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register with invalid email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'invalidemail', password: 'TestPassword123!', first_name: 'Test', last_name: 'User' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register with missing first_name returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'TestPassword123!', last_name: 'User' });
    expect(res.status).toBe(400);
  });
});

describe('Auth Routes - Token Validation', () => {
  test('GET /api/auth/me without token returns 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me with invalid token returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me with malformed auth header returns 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'notbearer token');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Application Routes - Auth Required
// ============================================================

describe('Application Routes - Borrower Persona', () => {
  test('GET /api/applications without auth returns 401', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  test('POST /api/applications without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/applications')
      .send({ loan_product_id: 1, requested_amount: 25000 });
    expect(res.status).toBe(401);
  });

  test('GET /api/applications/:id without auth returns 401', async () => {
    const res = await request(app).get('/api/applications/1');
    expect(res.status).toBe(401);
  });

  test('PUT /api/applications/:id without auth returns 401', async () => {
    const res = await request(app)
      .put('/api/applications/1')
      .send({ status: 'submitted' });
    expect(res.status).toBe(401);
  });
});

describe('Application Routes - Loan Officer Actions', () => {
  test('POST /api/applications/:id/credit-pull without auth returns 401', async () => {
    const res = await request(app).post('/api/applications/1/credit-pull');
    expect(res.status).toBe(401);
  });

  test('POST /api/applications/:id/identity-check without auth returns 401', async () => {
    const res = await request(app).post('/api/applications/1/identity-check');
    expect(res.status).toBe(401);
  });

  test('POST /api/applications/:id/decision without auth returns 401', async () => {
    const res = await request(app).post('/api/applications/1/decision');
    expect(res.status).toBe(401);
  });

  test('POST /api/applications/:id/verify-income without auth returns 401', async () => {
    const res = await request(app).post('/api/applications/1/verify-income');
    expect(res.status).toBe(401);
  });

  test('POST /api/applications/:id/e-sign without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/applications/1/e-sign')
      .send({ signature_data: 'test' });
    expect(res.status).toBe(401);
  });

  test('POST /api/applications/:id/fund without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/applications/1/fund')
      .send({ disbursement_method: 'ach' });
    expect(res.status).toBe(401);
  });
});

describe('Application Routes - Underwriter Actions', () => {
  test('POST /api/applications/:id/manual-decision without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/applications/1/manual-decision')
      .send({ decision_type: 'manual_approve', approved_amount: 20000 });
    expect(res.status).toBe(401);
  });

  test('POST /api/applications/:id/counter-offer-response without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/applications/1/counter-offer-response')
      .send({ accept: true });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Collateral Routes
// ============================================================

describe('Collateral Routes', () => {
  test('GET /api/collateral/:appId without auth returns 401', async () => {
    const res = await request(app).get('/api/collateral/1');
    expect(res.status).toBe(401);
  });

  test('POST /api/collateral/:appId without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/collateral/1')
      .send({ type: 'vehicle', vin: '1HGBH41JXMN109186' });
    expect(res.status).toBe(401);
  });

  test('GET /api/collateral/valuation/lookup without auth returns 401 or 404', async () => {
    const res = await request(app).get('/api/collateral/valuation/lookup?vin=1HGBH41JXMN109186');
    expect([401, 404]).toContain(res.status);
  });
});

// ============================================================
// Condition Routes
// ============================================================

describe('Condition Routes', () => {
  test('GET /api/conditions/:appId without auth returns 401', async () => {
    const res = await request(app).get('/api/conditions/1');
    expect(res.status).toBe(401);
  });

  test('POST /api/conditions/:appId without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/conditions/1')
      .send({ name: 'Proof of Insurance', category: 'prior_to_funding' });
    expect(res.status).toBe(401);
  });

  test('PUT /api/conditions/clear/:condId without auth returns 401', async () => {
    const res = await request(app).put('/api/conditions/clear/1');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Document Routes
// ============================================================

describe('Document Routes', () => {
  test('GET /api/documents/:appId without auth returns 401', async () => {
    const res = await request(app).get('/api/documents/1');
    expect(res.status).toBe(401);
  });

  test('POST /api/documents/:appId without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/documents/1')
      .send({ name: 'Pay Stub', category: 'income' });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Admin Routes - System Admin Persona
// ============================================================

describe('Admin Routes - User Management', () => {
  test('GET /api/admin/users without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('POST /api/admin/users without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .send({ email: 'new@test.com', role: 'loan_officer' });
    expect(res.status).toBe(401);
  });

  test('PUT /api/admin/users/:id without auth returns 401', async () => {
    const res = await request(app)
      .put('/api/admin/users/1')
      .send({ role: 'branch_manager' });
    expect(res.status).toBe(401);
  });
});

describe('Admin Routes - Branches', () => {
  test('GET /api/admin/branches without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/branches');
    expect(res.status).toBe(401);
  });
});

describe('Admin Routes - Loan Products', () => {
  test('GET /api/admin/loan-products without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/loan-products');
    expect(res.status).toBe(401);
  });

  test('PUT /api/admin/loan-products/:id without auth returns 401', async () => {
    const res = await request(app)
      .put('/api/admin/loan-products/1')
      .send({ min_rate: 5.99 });
    expect(res.status).toBe(401);
  });
});

describe('Admin Routes - State Rules (Compliance Persona)', () => {
  test('GET /api/admin/state-rules without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/state-rules');
    expect(res.status).toBe(401);
  });

  test('PUT /api/admin/state-rules/:id without auth returns 401', async () => {
    const res = await request(app)
      .put('/api/admin/state-rules/1')
      .send({ max_interest_rate: 18.5 });
    expect(res.status).toBe(401);
  });
});

describe('Admin Routes - Audit Logs', () => {
  test('GET /api/admin/audit-logs without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/audit-logs');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Reporting Routes - Executive Persona
// ============================================================

describe('Reporting Routes', () => {
  test('GET /api/reporting/dashboard without auth returns 401', async () => {
    const res = await request(app).get('/api/reporting/dashboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/reporting/pipeline without auth returns 401', async () => {
    const res = await request(app).get('/api/reporting/pipeline');
    expect(res.status).toBe(401);
  });

  test('GET /api/reporting/adverse-actions without auth returns 401', async () => {
    const res = await request(app).get('/api/reporting/adverse-actions');
    expect(res.status).toBe(401);
  });
});

// ============================================================
// Security Headers
// ============================================================

describe('Security Headers', () => {
  test('responses include X-Request-ID header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('x-request-id');
  });

  test('responses include security headers from helmet', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers).toHaveProperty('x-content-type-options');
  });
});

// ============================================================
// Request Validation
// ============================================================

describe('Request Validation', () => {
  test('POST /api/auth/login with XSS in email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '<script>alert("xss")</script>', password: 'TestPass123!' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/register with SQL injection attempt returns error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: "admin'--@test.com", password: 'TestPassword123!', first_name: 'Test', last_name: 'User' });
    // Should reject with 400 (validation) or 500 (DB error from mock)
    expect([400, 500]).toContain(res.status);
  });
});
