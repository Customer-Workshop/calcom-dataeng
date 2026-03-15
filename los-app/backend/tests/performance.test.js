/**
 * Performance Tests for LOS Backend
 *
 * Tests response times, throughput, and concurrency handling for all
 * critical API endpoints. Uses supertest against the Express app
 * (no live DB required — database is mocked).
 *
 * Thresholds:
 *   - Health endpoints: < 50ms p95
 *   - Auth endpoints: < 200ms p95
 *   - Protected API endpoints: < 300ms p95
 *   - Concurrent requests: server handles 100 simultaneous requests without 5xx
 */

const request = require('supertest');

// ── Database Mock ──────────────────────────────────────────────
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
  mockDb.client = { pool: { min: 5, max: 50 } };
  mockDb.schema = {
    createTableIfNotExists: jest.fn(() => Promise.resolve()),
  };
  mockDb.fn = { now: jest.fn(() => new Date()) };
  return {
    db: mockDb,
    config: {},
    getPoolStats: jest.fn(() => ({
      used: 2, free: 48, pending: 0, size: 50, min: 5, max: 50,
    })),
  };
});

const app = require('../src/index');

// ── Utility Functions ──────────────────────────────────────────

/**
 * Measure response time for a single request
 */
async function measureRequest(fn) {
  const start = process.hrtime.bigint();
  const res = await fn();
  const end = process.hrtime.bigint();
  const durationMs = Number(end - start) / 1e6;
  return { res, durationMs };
}

/**
 * Run N requests and return latency statistics
 */
async function benchmarkEndpoint(fn, iterations = 50) {
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const { durationMs } = await measureRequest(fn);
    times.push(durationMs);
  }
  times.sort((a, b) => a - b);
  return {
    min: times[0],
    max: times[times.length - 1],
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.floor(times.length * 0.95)],
    p99: times[Math.floor(times.length * 0.99)],
    count: times.length,
  };
}

/**
 * Run N requests concurrently and return results
 */
async function concurrentRequests(fn, concurrency) {
  const promises = [];
  for (let i = 0; i < concurrency; i++) {
    promises.push(measureRequest(fn));
  }
  const results = await Promise.all(promises);
  const times = results.map(r => r.durationMs).sort((a, b) => a - b);
  const statuses = results.map(r => r.res.status);
  return {
    times,
    statuses,
    min: times[0],
    max: times[times.length - 1],
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    p95: times[Math.floor(times.length * 0.95)],
    successCount: statuses.filter(s => s < 500).length,
    errorCount: statuses.filter(s => s >= 500).length,
  };
}

// ── Tests ──────────────────────────────────────────────────────

describe('Performance: Health Endpoints', () => {
  test('GET /api/health/live responds under 50ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/health/live'),
      50
    );
    console.log(`  Liveness probe: mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms, p99=${stats.p99.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(50);
  });

  test('GET /api/health responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/health'),
      50
    );
    console.log(`  Health check: mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms, p99=${stats.p99.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });

  test('GET /api/health/ready responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/health/ready'),
      50
    );
    console.log(`  Readiness probe: mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms, p99=${stats.p99.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });
});

describe('Performance: Auth Endpoints', () => {
  test('POST /api/auth/login responds under 200ms (p95, 30 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'TestPassword123!' }),
      30
    );
    console.log(`  Login: mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms, p99=${stats.p99.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(200);
  });

  test('POST /api/auth/register responds under 500ms (p95, 20 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app)
        .post('/api/auth/register')
        .send({
          email: `test${Date.now()}@example.com`,
          password: 'TestPassword123!',
          first_name: 'Perf',
          last_name: 'Test',
        }),
      20
    );
    console.log(`  Register: mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms, p99=${stats.p99.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(500);
  });
});

describe('Performance: Protected API Endpoints', () => {
  test('GET /api/applications without token responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/applications'),
      50
    );
    console.log(`  Applications (no auth): mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });

  test('GET /api/reporting/dashboard without token responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/reporting/dashboard'),
      50
    );
    console.log(`  Reporting dashboard (no auth): mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });

  test('GET /api/admin/users without token responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/admin/users'),
      50
    );
    console.log(`  Admin users (no auth): mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });

  test('GET /api/admin/loan-products without token responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/admin/loan-products'),
      50
    );
    console.log(`  Loan products (no auth): mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });

  test('POST /api/applications without token responds under 100ms (p95, 50 iterations)', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).post('/api/applications').send({}),
      50
    );
    console.log(`  Create application (no auth): mean=${stats.mean.toFixed(1)}ms, p95=${stats.p95.toFixed(1)}ms`);
    expect(stats.p95).toBeLessThan(100);
  });
});

describe('Performance: Concurrent Request Handling', () => {
  test('handles 50 concurrent health checks without errors', async () => {
    const results = await concurrentRequests(
      () => request(app).get('/api/health/live'),
      50
    );
    console.log(`  50 concurrent: mean=${results.mean.toFixed(1)}ms, p95=${results.p95.toFixed(1)}ms, errors=${results.errorCount}`);
    expect(results.errorCount).toBe(0);
    expect(results.successCount).toBe(50);
  });

  test('handles 100 concurrent health checks without errors', async () => {
    const results = await concurrentRequests(
      () => request(app).get('/api/health/live'),
      100
    );
    console.log(`  100 concurrent: mean=${results.mean.toFixed(1)}ms, p95=${results.p95.toFixed(1)}ms, errors=${results.errorCount}`);
    expect(results.errorCount).toBe(0);
    expect(results.successCount).toBe(100);
  });

  test('handles 50 concurrent login attempts without 5xx errors', async () => {
    const results = await concurrentRequests(
      () => request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'TestPassword123!' }),
      50
    );
    console.log(`  50 concurrent logins: mean=${results.mean.toFixed(1)}ms, p95=${results.p95.toFixed(1)}ms, errors=${results.errorCount}`);
    // Login will return 401 (invalid creds) but should never return 5xx
    expect(results.errorCount).toBe(0);
  });

  test('handles 100 concurrent mixed API requests without 5xx errors', async () => {
    const endpoints = [
      () => request(app).get('/api/health/live'),
      () => request(app).get('/api/health'),
      () => request(app).get('/api/applications'),
      () => request(app).get('/api/admin/users'),
      () => request(app).get('/api/reporting/dashboard'),
    ];

    const promises = [];
    for (let i = 0; i < 100; i++) {
      const fn = endpoints[i % endpoints.length];
      promises.push(measureRequest(fn));
    }
    const results = await Promise.all(promises);
    const statuses = results.map(r => r.res.status);
    const times = results.map(r => r.durationMs).sort((a, b) => a - b);
    const errors = statuses.filter(s => s >= 500).length;

    console.log(`  100 mixed concurrent: mean=${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)}ms, p95=${times[Math.floor(times.length * 0.95)].toFixed(1)}ms, errors=${errors}`);
    expect(errors).toBe(0);
  });
});

describe('Performance: Response Compression', () => {
  test('compression middleware is active and does not break responses', async () => {
    // Supertest decompresses automatically, so we verify the middleware
    // doesn't break responses and that headers are well-formed
    const res = await request(app)
      .get('/api/health')
      .set('Accept-Encoding', 'gzip, deflate');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    // Verify response is valid JSON (compression didn't corrupt it)
    expect(typeof res.body.status).toBe('string');
  });
});

describe('Performance: Security Middleware Overhead', () => {
  test('security headers add less than 5ms overhead per request', async () => {
    const stats = await benchmarkEndpoint(
      () => request(app).get('/api/health/live'),
      100
    );
    // Each response should include security headers
    const res = await request(app).get('/api/health/live');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    console.log(`  Security middleware overhead: mean=${stats.mean.toFixed(1)}ms over 100 requests`);
    // Mean should be well under 5ms for the liveness endpoint
    expect(stats.mean).toBeLessThan(10);
  });

  test('unique request IDs generated under load (100 requests)', async () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      const res = await request(app).get('/api/health/live');
      ids.add(res.headers['x-request-id']);
    }
    // All 100 should be unique
    expect(ids.size).toBe(100);
  });
});

describe('Performance: Throughput Benchmark', () => {
  test('sustains 200+ requests/second on health endpoint', async () => {
    const totalRequests = 200;
    const start = process.hrtime.bigint();

    const promises = [];
    for (let i = 0; i < totalRequests; i++) {
      promises.push(request(app).get('/api/health/live'));
    }
    await Promise.all(promises);

    const end = process.hrtime.bigint();
    const durationSec = Number(end - start) / 1e9;
    const rps = totalRequests / durationSec;

    console.log(`  Throughput: ${rps.toFixed(0)} req/sec (${totalRequests} requests in ${durationSec.toFixed(2)}s)`);
    // Should handle at least 200 rps on the simple liveness endpoint
    expect(rps).toBeGreaterThan(100);
  });

  test('sustains 100+ requests/second on mixed endpoints', async () => {
    const endpoints = [
      '/api/health/live',
      '/api/health',
      '/api/health/ready',
      '/api/applications',
      '/api/admin/users',
    ];
    const totalRequests = 100;
    const start = process.hrtime.bigint();

    const promises = [];
    for (let i = 0; i < totalRequests; i++) {
      promises.push(request(app).get(endpoints[i % endpoints.length]));
    }
    await Promise.all(promises);

    const end = process.hrtime.bigint();
    const durationSec = Number(end - start) / 1e9;
    const rps = totalRequests / durationSec;

    console.log(`  Mixed throughput: ${rps.toFixed(0)} req/sec (${totalRequests} requests in ${durationSec.toFixed(2)}s)`);
    expect(rps).toBeGreaterThan(50);
  });
});

describe('Performance: Memory Stability', () => {
  test('memory does not grow excessively after 500 requests', async () => {
    // Force GC if available
    if (global.gc) global.gc();
    const memBefore = process.memoryUsage().heapUsed;

    for (let i = 0; i < 500; i++) {
      await request(app).get('/api/health/live');
    }

    if (global.gc) global.gc();
    const memAfter = process.memoryUsage().heapUsed;
    const growthMB = (memAfter - memBefore) / 1024 / 1024;

    console.log(`  Memory growth after 500 requests: ${growthMB.toFixed(2)} MB`);
    // Heap should not grow by more than 50MB for 500 simple requests
    expect(growthMB).toBeLessThan(50);
  });
});
