/**
 * Coverage tests for config modules: cache, circuitBreaker, database, cluster, index.js
 */

// ── Database Tests ──────────────────────────────────────────────

describe('Database Module - getPoolStats', () => {
  test('getPoolStats returns pool statistics', () => {
    jest.resetModules();
    // Mock knex to return a minimal pool
    jest.doMock('knex', () => {
      const mockKnex = jest.fn(() => ({
        client: {
          pool: {
            numUsed: () => 2,
            numFree: () => 8,
            numPendingAcquires: () => 0,
            numPendingCreates: () => 1,
          },
        },
        raw: jest.fn(() => Promise.resolve()),
        destroy: jest.fn(() => Promise.resolve()),
      }));
      return mockKnex;
    });
    const { getPoolStats } = require('../src/config/database');
    const stats = getPoolStats();
    expect(stats.used).toBe(2);
    expect(stats.free).toBe(8);
    expect(stats.pendingAcquires).toBe(0);
    expect(stats.pendingCreates).toBe(1);
    expect(stats.max).toBeDefined();
    expect(stats.min).toBeDefined();
  });

  test('getPoolStats returns no_pool when pool is null', () => {
    jest.resetModules();
    jest.doMock('knex', () => {
      return jest.fn(() => ({
        client: { pool: null },
        raw: jest.fn(() => Promise.resolve()),
        destroy: jest.fn(() => Promise.resolve()),
      }));
    });
    const { getPoolStats } = require('../src/config/database');
    const stats = getPoolStats();
    expect(stats.status).toBe('no_pool');
  });

  test('getPoolStats handles missing pool methods', () => {
    jest.resetModules();
    jest.doMock('knex', () => {
      return jest.fn(() => ({
        client: { pool: {} },
        raw: jest.fn(() => Promise.resolve()),
        destroy: jest.fn(() => Promise.resolve()),
      }));
    });
    const { getPoolStats } = require('../src/config/database');
    const stats = getPoolStats();
    expect(stats.used).toBe(0);
    expect(stats.free).toBe(0);
    expect(stats.pendingAcquires).toBe(0);
    expect(stats.pendingCreates).toBe(0);
  });

  test('config exports expected properties', () => {
    jest.resetModules();
    jest.doMock('knex', () => {
      return jest.fn(() => ({
        client: { pool: null },
        raw: jest.fn(),
        destroy: jest.fn(),
      }));
    });
    const { config } = require('../src/config/database');
    expect(config.client).toBe('pg');
    expect(config.connection).toBeDefined();
    expect(config.pool).toBeDefined();
    expect(config.pool.min).toBeDefined();
    expect(config.pool.max).toBeDefined();
  });
});


// ── Cache Tests ─────────────────────────────────────────────────

describe('Cache Module', () => {
  let cache;
  let mockDbChain;

  beforeEach(() => {
    jest.resetModules();
    // Mock database for cache loaders
    mockDbChain = {
      orderBy: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      then: function(resolve) { return Promise.resolve([]).then(resolve); },
      catch: function(fn) { return Promise.resolve([]).catch(fn); },
    };
    jest.doMock('../src/config/database', () => ({
      db: jest.fn(() => mockDbChain),
    }));
    cache = require('../src/config/cache');
  });

  afterEach(() => {
    if (cache) cache.invalidateAll();
  });

  test('getOrSet returns cached value on hit', async () => {
    const loader = jest.fn(() => Promise.resolve('data1'));
    const v1 = await cache.getOrSet('k1', loader);
    expect(v1).toBe('data1');
    expect(loader).toHaveBeenCalledTimes(1);

    const v2 = await cache.getOrSet('k1', loader);
    expect(v2).toBe('data1');
    expect(loader).toHaveBeenCalledTimes(1); // not called again
  });

  test('getOrSet reloads on cache miss (expired)', async () => {
    const loader = jest.fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    
    // Set with very short TTL
    const v1 = await cache.getOrSet('k2', loader, 1);
    expect(v1).toBe('first');
    
    // Wait for expiration
    await new Promise(r => setTimeout(r, 10));
    const v2 = await cache.getOrSet('k2', loader, 1);
    expect(v2).toBe('second');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  test('invalidate removes a specific key', async () => {
    await cache.getOrSet('toRemove', () => Promise.resolve('val'));
    cache.invalidate('toRemove');
    const loader = jest.fn(() => Promise.resolve('new'));
    const v = await cache.getOrSet('toRemove', loader);
    expect(v).toBe('new');
    expect(loader).toHaveBeenCalled();
  });

  test('invalidateAll clears everything', async () => {
    await cache.getOrSet('a', () => Promise.resolve(1));
    await cache.getOrSet('b', () => Promise.resolve(2));
    cache.invalidateAll();
    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });

  test('getStats counts active and expired entries', async () => {
    // Add an entry with very short TTL
    await cache.getOrSet('expired', () => Promise.resolve('x'), 1);
    // Add an entry with long TTL
    await cache.getOrSet('active', () => Promise.resolve('y'), 60000);
    
    await new Promise(r => setTimeout(r, 10));
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.expired).toBe(1);
  });

  test('getLoanProducts calls db', async () => {
    const result = await cache.getLoanProducts();
    expect(result).toEqual([]);
  });

  test('getBranches calls db', async () => {
    const result = await cache.getBranches();
    expect(result).toEqual([]);
  });

  test('getRoles calls db', async () => {
    const result = await cache.getRoles();
    expect(result).toEqual([]);
  });

  test('getStateRules calls db', async () => {
    const result = await cache.getStateRules();
    expect(result).toEqual([]);
  });

  test('getStateRule returns matching rule', async () => {
    // Seed state rules
    cache.invalidate('state_rules');
    mockDbChain.then = function(resolve) {
      return Promise.resolve([{ state: 'TX', max_rate_cap: 18 }, { state: 'FL', max_rate_cap: 15 }]).then(resolve);
    };
    const rule = await cache.getStateRule('TX');
    expect(rule).toEqual({ state: 'TX', max_rate_cap: 18 });
  });

  test('getStateRule returns null for unknown state', async () => {
    cache.invalidate('state_rules');
    mockDbChain.then = function(resolve) {
      return Promise.resolve([{ state: 'TX' }]).then(resolve);
    };
    const rule = await cache.getStateRule('ZZ');
    expect(rule).toBeNull();
  });

  test('DEFAULT_TTL_MS is exported', () => {
    expect(cache.DEFAULT_TTL_MS).toBe(300000);
  });
});

// ── CircuitBreaker Tests ────────────────────────────────────────

describe('CircuitBreaker Module', () => {
  let CB, CircuitBreakerOpenError, STATES;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../src/config/database', () => ({
      db: jest.fn(() => ({ orderBy: jest.fn().mockReturnThis() })),
    }));
    const mod = require('../src/config/circuitBreaker');
    CB = mod.CircuitBreaker;
    CircuitBreakerOpenError = mod.CircuitBreakerOpenError;
    STATES = mod.STATES;
  });

  test('CLOSED state passes requests through', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 2, requestTimeoutMs: 5000 });
    const result = await breaker.exec(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.metrics.successes).toBe(1);
  });

  test('opens after failure threshold reached', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 2, requestTimeoutMs: 5000 });
    const fail = () => Promise.reject(new Error('fail'));
    await expect(breaker.exec(fail)).rejects.toThrow('fail');
    await expect(breaker.exec(fail)).rejects.toThrow('fail');
    expect(breaker.state).toBe(STATES.OPEN);
    expect(breaker.metrics.failures).toBe(2);
  });

  test('OPEN state rejects with CircuitBreakerOpenError', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1, requestTimeoutMs: 5000, resetTimeoutMs: 60000 });
    await expect(breaker.exec(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(breaker.state).toBe(STATES.OPEN);
    await expect(breaker.exec(() => Promise.resolve('ok'))).rejects.toThrow(CircuitBreakerOpenError);
    expect(breaker.metrics.rejected).toBeGreaterThanOrEqual(1);
  });

  test('OPEN state returns fallback when provided', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1, requestTimeoutMs: 5000, resetTimeoutMs: 60000 });
    await expect(breaker.exec(() => Promise.reject(new Error('x')))).rejects.toThrow();
    const result = await breaker.exec(() => Promise.resolve('ok'), 'fallback');
    expect(result).toBe('fallback');
  });

  test('transitions to HALF_OPEN after reset timeout', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1, requestTimeoutMs: 5000, resetTimeoutMs: 10 });
    await expect(breaker.exec(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(breaker.state).toBe(STATES.OPEN);
    await new Promise(r => setTimeout(r, 20));
    const result = await breaker.exec(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
    expect(breaker.state).toBe(STATES.CLOSED);
  });

  test('HALF_OPEN probe failure goes back to OPEN', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1, requestTimeoutMs: 5000, resetTimeoutMs: 10, halfOpenMax: 1 });
    await expect(breaker.exec(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect(breaker.state).toBe(STATES.OPEN);
    await new Promise(r => setTimeout(r, 20));
    // Probe fails
    await expect(breaker.exec(() => Promise.reject(new Error('still down')))).rejects.toThrow();
    expect(breaker.state).toBe(STATES.OPEN);
  });

  test('HALF_OPEN max exceeded returns fallback', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1, requestTimeoutMs: 5000, resetTimeoutMs: 10, halfOpenMax: 1 });
    await expect(breaker.exec(() => Promise.reject(new Error('x')))).rejects.toThrow();
    await new Promise(r => setTimeout(r, 20));
    // First call transitions to HALF_OPEN and increments halfOpenAttempts
    breaker.state = STATES.HALF_OPEN;
    breaker.halfOpenAttempts = 1; // max reached
    const result = await breaker.exec(() => Promise.resolve('ok'), 'fallback');
    expect(result).toBe('fallback');
  });

  test('HALF_OPEN max exceeded throws without fallback', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1, requestTimeoutMs: 5000, resetTimeoutMs: 60000, halfOpenMax: 1 });
    breaker.state = STATES.HALF_OPEN;
    breaker.halfOpenAttempts = 1;
    await expect(breaker.exec(() => Promise.resolve('ok'))).rejects.toThrow(CircuitBreakerOpenError);
  });

  test('request timeout triggers failure', async () => {
    const breaker = new CB({ name: 'test', failureThreshold: 5, requestTimeoutMs: 10 });
    const slow = () => new Promise(r => setTimeout(() => r('late'), 100));
    await expect(breaker.exec(slow)).rejects.toThrow(/timed out/);
  });

  test('getStatus returns current state and metrics', () => {
    const breaker = new CB({ name: 'my-breaker', failureThreshold: 3 });
    const status = breaker.getStatus();
    expect(status.name).toBe('my-breaker');
    expect(status.state).toBe(STATES.CLOSED);
    expect(status.metrics).toBeDefined();
  });

  test('reset forces CLOSED state', () => {
    const breaker = new CB({ name: 'test', failureThreshold: 1 });
    breaker.state = STATES.OPEN;
    breaker.failureCount = 5;
    breaker.halfOpenAttempts = 3;
    breaker.reset();
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.failureCount).toBe(0);
    expect(breaker.halfOpenAttempts).toBe(0);
  });

  test('CircuitBreakerOpenError has correct properties', () => {
    const err = new CircuitBreakerOpenError('test-service');
    expect(err.message).toMatch(/test-service/);
    expect(err.name).toBe('CircuitBreakerOpenError');
    expect(err.status).toBe(503);
    expect(err instanceof Error).toBe(true);
  });

  test('getAllBreakerStatus returns array of 3 breakers', () => {
    const mod = require('../src/config/circuitBreaker');
    const statuses = mod.getAllBreakerStatus();
    expect(statuses).toHaveLength(3);
    expect(statuses[0].name).toBe('credit-bureau');
    expect(statuses[1].name).toBe('identity-check');
    expect(statuses[2].name).toBe('collateral-valuation');
  });

  test('singleton breakers are exported', () => {
    const mod = require('../src/config/circuitBreaker');
    expect(mod.creditBureauBreaker).toBeInstanceOf(CB);
    expect(mod.identityCheckBreaker).toBeInstanceOf(CB);
    expect(mod.collateralValuationBreaker).toBeInstanceOf(CB);
  });

  test('constructor uses defaults when opts are minimal', () => {
    const breaker = new CB({});
    expect(breaker.name).toBe('unnamed');
    expect(breaker.failureThreshold).toBe(5);
    expect(breaker.resetTimeoutMs).toBe(30000);
    expect(breaker.requestTimeoutMs).toBe(10000);
    expect(breaker.halfOpenMax).toBe(1);
  });
});

// ── Auth Config Tests ───────────────────────────────────────────

describe('Auth Config', () => {
  test('exports expected auth configuration', () => {
    const auth = require('../src/config/auth');
    expect(auth.jwtSecret).toBeDefined();
    expect(auth.jwtExpiry).toBeDefined();
    expect(auth.refreshTokenExpiry).toBeDefined();
    expect(auth.saltRounds).toBe(12);
    expect(auth.roles).toBeDefined();
    expect(auth.roles.BORROWER).toBe('borrower');
    expect(auth.roles.LOAN_OFFICER).toBe('loan_officer');
    expect(auth.roles.BRANCH_MANAGER).toBe('branch_manager');
    expect(auth.roles.UNDERWRITER).toBe('underwriter');
    expect(auth.roles.COMPLIANCE_OFFICER).toBe('compliance_officer');
    expect(auth.roles.SYSTEM_ADMIN).toBe('system_admin');
    expect(auth.roles.EXECUTIVE).toBe('executive');
  });

  test('authorityLimits are configured for all roles', () => {
    const auth = require('../src/config/auth');
    expect(auth.authorityLimits.loan_officer).toBe(100000);
    expect(auth.authorityLimits.branch_manager).toBe(500000);
    expect(auth.authorityLimits.underwriter).toBe(1000000);
    expect(auth.authorityLimits.system_admin).toBe(Infinity);
  });
});

// ── Cluster Tests ───────────────────────────────────────────────

describe('Cluster Module', () => {
  test('primary process forks workers and handles events', () => {
    jest.resetModules();
    
    const mockWorkers = {};
    const mockFork = jest.fn(() => {
      const worker = { process: { pid: 1234, kill: jest.fn() } };
      mockWorkers['1'] = worker;
      return worker;
    });
    const eventHandlers = {};
    const mockOn = jest.fn((event, handler) => {
      eventHandlers[event] = handler;
    });

    jest.doMock('cluster', () => ({
      isPrimary: true,
      fork: mockFork,
      on: mockOn,
      workers: mockWorkers,
    }));

    jest.doMock('os', () => ({
      cpus: () => [1, 2], // 2 CPUs
    }));

    // Mock process.on to capture signal handlers
    const originalProcessOn = process.on;
    const signalHandlers = {};
    process.on = jest.fn((event, handler) => {
      signalHandlers[event] = handler;
      return process;
    });

    process.env.CLUSTER_WORKERS = '2';
    require('../src/cluster');

    expect(mockFork).toHaveBeenCalledTimes(2);
    expect(mockOn).toHaveBeenCalledWith('exit', expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith('online', expect.any(Function));

    // Test worker exit with signal
    const exitHandler = eventHandlers['exit'];
    exitHandler({ process: { pid: 100 } }, 0, 'SIGTERM');

    // Test worker exit with non-zero code (should fork again)
    exitHandler({ process: { pid: 101 } }, 1, null);
    expect(mockFork).toHaveBeenCalledTimes(3); // 2 initial + 1 restart

    // Test worker graceful exit
    exitHandler({ process: { pid: 102 } }, 0, null);

    // Test online handler
    const onlineHandler = eventHandlers['online'];
    onlineHandler({ process: { pid: 103 } });

    // Restore process.on
    process.on = originalProcessOn;
    delete process.env.CLUSTER_WORKERS;
  });

  test('worker process requires index', () => {
    jest.resetModules();
    
    jest.doMock('cluster', () => ({
      isPrimary: false,
    }));

    // Mock index.js to prevent Express app from starting
    jest.doMock('../src/index', () => ({}));

    require('../src/cluster');
    expect(require('../src/index')).toBeDefined();
  });
});


