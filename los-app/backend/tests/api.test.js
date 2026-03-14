const request = require('supertest');
const app = require('../src/index');

// Mock the database module
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
  mockDb.schema = {
    createTableIfNotExists: jest.fn(() => Promise.resolve()),
  };
  mockDb.fn = { now: jest.fn(() => new Date()) };
  return { db: mockDb, config: {} };
});

describe('Health Check', () => {
  test('GET /api/health returns 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
  });
});

describe('404 Handler', () => {
  test('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Route not found');
  });
});

describe('Auth Routes', () => {
  test('POST /api/auth/login with missing fields returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  test('POST /api/auth/login with invalid email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'notanemail', password: 'password123' });
    expect(res.status).toBe(400);
  });

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
});

describe('Application Routes', () => {
  test('GET /api/applications without auth returns 401', async () => {
    const res = await request(app).get('/api/applications');
    expect(res.status).toBe(401);
  });

  test('POST /api/applications without auth returns 401', async () => {
    const res = await request(app)
      .post('/api/applications')
      .send({});
    expect(res.status).toBe(401);
  });

  test('GET /api/applications/:id without auth returns 401', async () => {
    const res = await request(app).get('/api/applications/1');
    expect(res.status).toBe(401);
  });
});

describe('Collateral Routes', () => {
  test('GET /api/collateral/:appId without auth returns 401', async () => {
    const res = await request(app).get('/api/collateral/1');
    expect(res.status).toBe(401);
  });
});

describe('Condition Routes', () => {
  test('GET /api/conditions/:appId without auth returns 401', async () => {
    const res = await request(app).get('/api/conditions/1');
    expect(res.status).toBe(401);
  });
});

describe('Document Routes', () => {
  test('GET /api/documents/:appId without auth returns 401', async () => {
    const res = await request(app).get('/api/documents/1');
    expect(res.status).toBe(401);
  });
});

describe('Admin Routes', () => {
  test('GET /api/admin/users without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/branches without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/branches');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/loan-products without auth returns 401', async () => {
    const res = await request(app).get('/api/admin/loan-products');
    expect(res.status).toBe(401);
  });
});

describe('Reporting Routes', () => {
  test('GET /api/reporting/dashboard without auth returns 401', async () => {
    const res = await request(app).get('/api/reporting/dashboard');
    expect(res.status).toBe(401);
  });

  test('GET /api/reporting/pipeline without auth returns 401', async () => {
    const res = await request(app).get('/api/reporting/pipeline');
    expect(res.status).toBe(401);
  });
});
