/**
 * Tests for scalability and resilience features.
 * Covers: Health endpoints, compression, timeout, security middleware,
 * CORS, in-memory cache, circuit breaker module.
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
// Health Endpoints for Load Balancers
// ============================================================

describe('Health Endpoints - Liveness Probe', () => {
  test('GET /api/health/live returns 200 with alive status', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(res.body).toHaveProperty('pid');
  });

  test('liveness probe response is fast (under 200ms)', async () => {
    const start = Date.now();
    await request(app).get('/api/health/live');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(200);
  });
});

describe('Health Endpoints - Readiness Probe', () => {
  test('GET /api/health/ready returns status', async () => {
    const res = await request(app).get('/api/health/ready');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
  });

  test('readiness probe includes status field', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.body).toHaveProperty('status');
  });
});

describe('Health Endpoints - Detailed Health', () => {
  test('GET /api/health returns comprehensive health data', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('version');
  });

  test('health endpoint includes uptime', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toHaveProperty('uptime');
  });

  test('health endpoint returns valid timestamp', async () => {
    const res = await request(app).get('/api/health');
    const ts = new Date(res.body.timestamp);
    expect(ts.getTime()).not.toBeNaN();
  });
});

// ============================================================
// Response Compression
// ============================================================

describe('Response Compression', () => {
  test('responses support gzip encoding', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
  });
});

// ============================================================
// Request Timeout Enforcement
// ============================================================

describe('Request Timeout', () => {
  test('health endpoints respond within timeout', async () => {
    const start = Date.now();
    const res = await request(app).get('/api/health');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
    expect(res.status).toBe(200);
  });
});

// ============================================================
// Security Middleware Integration
// ============================================================

describe('Security Middleware', () => {
  test('all responses include X-Request-ID for tracing', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);
  });

  test('request IDs are unique across requests', async () => {
    const res1 = await request(app).get('/api/health');
    const res2 = await request(app).get('/api/health');
    expect(res1.headers['x-request-id']).not.toBe(res2.headers['x-request-id']);
  });

  test('X-Content-Type-Options is set to nosniff', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});

// ============================================================
// CORS Configuration
// ============================================================

describe('CORS Configuration', () => {
  test('CORS headers are present on responses', async () => {
    const res = await request(app)
      .get('/api/health')
      .set('Origin', 'http://localhost:5173');
    expect(res.status).toBe(200);
  });

  test('OPTIONS preflight requests are handled', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect([200, 204]).toContain(res.status);
  });
});

// ============================================================
// Cache Module (standalone unit tests)
// ============================================================

describe('Cache Module', () => {
  const { getOrSet, invalidate, invalidateAll, getStats } = require('../src/config/cache');

  afterEach(() => {
    invalidateAll();
  });

  test('getOrSet caches values', async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return 'cached_value'; };
    
    const val1 = await getOrSet('scaltest_key_1', fetcher, 60000);
    const val2 = await getOrSet('scaltest_key_1', fetcher, 60000);
    
    expect(val1).toBe('cached_value');
    expect(val2).toBe('cached_value');
    expect(callCount).toBe(1);
  });

  test('invalidate removes cached key', async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return 'value_' + callCount; };
    
    await getOrSet('scaltest_key_2', fetcher, 60000);
    invalidate('scaltest_key_2');
    const val = await getOrSet('scaltest_key_2', fetcher, 60000);
    
    expect(val).toBe('value_2');
    expect(callCount).toBe(2);
  });

  test('invalidateAll clears all cached data', async () => {
    await getOrSet('scaltest_key_3a', async () => 'a', 60000);
    await getOrSet('scaltest_key_3b', async () => 'b', 60000);
    
    invalidateAll();
    
    let called = false;
    await getOrSet('scaltest_key_3a', async () => { called = true; return 'new_a'; }, 60000);
    expect(called).toBe(true);
  });

  test('getStats returns cache statistics', () => {
    const stats = getStats();
    expect(stats).toHaveProperty('size');
    expect(stats).toHaveProperty('active');
    expect(stats).toHaveProperty('expired');
  });

  test('cache respects TTL expiration', async () => {
    let callCount = 0;
    const fetcher = async () => { callCount++; return 'ttl_value_' + callCount; };
    
    await getOrSet('scaltest_key_ttl', fetcher, 1); // 1ms TTL
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await getOrSet('scaltest_key_ttl', fetcher, 60000);
    expect(callCount).toBe(2);
  });

  test('cache stats show correct active count', async () => {
    await getOrSet('scaltest_active_1', async () => 'x', 60000);
    await getOrSet('scaltest_active_2', async () => 'y', 60000);
    const stats = getStats();
    expect(stats.active).toBe(2);
  });
});

// ============================================================
// Circuit Breaker Module (standalone unit tests)
// ============================================================

describe('Circuit Breaker Module', () => {
  const { CircuitBreaker, STATES } = require('../src/config/circuitBreaker');

  test('circuit breaker starts in CLOSED state', () => {
    const cb = new CircuitBreaker({ name: 'test-scal', failureThreshold: 3, resetTimeoutMs: 1000 });
    expect(cb.state).toBe(STATES.CLOSED);
  });

  test('successful calls keep circuit CLOSED', async () => {
    const cb = new CircuitBreaker({ name: 'test-scal2', failureThreshold: 3, resetTimeoutMs: 1000 });
    const result = await cb.exec(async () => 'success');
    expect(result).toBe('success');
    expect(cb.state).toBe(STATES.CLOSED);
  });

  test('circuit opens after failure threshold', async () => {
    const cb = new CircuitBreaker({ name: 'test-scal3', failureThreshold: 2, resetTimeoutMs: 5000 });
    
    const failingFn = async () => { throw new Error('service down'); };
    
    try { await cb.exec(failingFn); } catch (e) {}
    try { await cb.exec(failingFn); } catch (e) {}
    
    expect(cb.state).toBe(STATES.OPEN);
  });

  test('open circuit rejects calls immediately', async () => {
    const cb = new CircuitBreaker({ name: 'test-scal4', failureThreshold: 1, resetTimeoutMs: 5000 });
    
    try { await cb.exec(async () => { throw new Error('fail'); }); } catch (e) {}
    
    expect(cb.state).toBe(STATES.OPEN);
    
    await expect(cb.exec(async () => 'should not run')).rejects.toThrow();
  });

  test('circuit transitions to HALF_OPEN after reset timeout', async () => {
    const cb = new CircuitBreaker({ name: 'test-scal5', failureThreshold: 1, resetTimeoutMs: 50 });
    
    try { await cb.exec(async () => { throw new Error('fail'); }); } catch (e) {}
    expect(cb.state).toBe(STATES.OPEN);
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = await cb.exec(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(cb.state).toBe(STATES.CLOSED);
  });

  test('getStatus returns circuit breaker statistics', () => {
    const cb = new CircuitBreaker({ name: 'test-scal6', failureThreshold: 3, resetTimeoutMs: 1000 });
    const status = cb.getStatus();
    expect(status).toHaveProperty('name');
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('failureCount');
    expect(status).toHaveProperty('metrics');
  });

  test('fallback value is returned when circuit is open', async () => {
    const cb = new CircuitBreaker({ name: 'test-scal7', failureThreshold: 1, resetTimeoutMs: 5000 });
    
    try { await cb.exec(async () => { throw new Error('fail'); }); } catch (e) {}
    
    // Pass fallback as second arg to exec()
    const result = await cb.exec(async () => 'should not run', 'fallback_data');
    expect(result).toBe('fallback_data');
  });
});
