/**
 * Unit tests for backend utility modules:
 *   - Encryption (AES-256-GCM)
 *   - Cache (in-memory TTL cache)
 *   - Circuit Breaker pattern
 */

const {
  encrypt,
  decrypt,
  isEncrypted,
  hashValue,
  maskSensitive,
  encryptFields,
  decryptFields,
  maskFields,
  generateSecureToken,
  generateRequestId,
  clearKeyCache,
} = require('../src/utils/encryption');

// ── Encryption Tests ─────────────────────────────────────────

describe('Encryption — AES-256-GCM', () => {
  afterAll(() => clearKeyCache());

  test('encrypt returns enc: prefixed ciphertext', () => {
    const encrypted = encrypt('hello world');
    expect(encrypted).toMatch(/^enc:/);
    expect(encrypted.split(':').length).toBe(4);
  });

  test('decrypt reverses encrypt', () => {
    const original = 'SSN-1234';
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  test('encrypt/decrypt handles numeric strings', () => {
    expect(decrypt(encrypt('75000'))).toBe('75000');
    expect(decrypt(encrypt('0'))).toBe('0');
  });

  test('encrypt returns empty/null values unchanged', () => {
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeUndefined();
    expect(encrypt('')).toBe('');
  });

  test('decrypt returns non-encrypted values unchanged', () => {
    expect(decrypt('plaintext')).toBe('plaintext');
    expect(decrypt(null)).toBeNull();
    expect(decrypt('')).toBe('');
  });

  test('isEncrypted detects encrypted values', () => {
    expect(isEncrypted(encrypt('test'))).toBe(true);
    expect(isEncrypted('plaintext')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(123)).toBe(false);
  });

  test('each encryption produces unique ciphertext (random IV)', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  test('hashValue returns consistent hex hash', () => {
    const h1 = hashValue('1234');
    const h2 = hashValue('1234');
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  test('hashValue returns null for empty input', () => {
    expect(hashValue(null)).toBeNull();
    expect(hashValue('')).toBeNull();
  });

  test('different inputs produce different hashes', () => {
    expect(hashValue('1234')).not.toBe(hashValue('5678'));
  });
});

describe('Encryption — Mask Utilities', () => {
  test('maskSensitive masks all but last 4 chars', () => {
    expect(maskSensitive('123-45-6789')).toBe('*******6789');
    expect(maskSensitive('1234')).toBe('****'); // length <= visibleChars gets fully masked
    expect(maskSensitive('AB')).toBe('**');
  });

  test('maskSensitive handles null/undefined', () => {
    expect(maskSensitive(null)).toBeNull();
    expect(maskSensitive(undefined)).toBeUndefined();
  });

  test('encryptFields encrypts specified fields in place', () => {
    const obj = { ssn: '1234', name: 'John' };
    encryptFields(obj, ['ssn']);
    expect(isEncrypted(obj.ssn)).toBe(true);
    expect(obj.name).toBe('John');
  });

  test('encryptFields skips already encrypted values', () => {
    const obj = { ssn: encrypt('1234') };
    const before = obj.ssn;
    encryptFields(obj, ['ssn']);
    expect(obj.ssn).toBe(before);
  });

  test('decryptFields decrypts specified fields in place', () => {
    const obj = { income: encrypt('75000'), name: 'Test' };
    decryptFields(obj, ['income']);
    expect(obj.income).toBe('75000');
    expect(obj.name).toBe('Test');
  });

  test('decryptFields handles null object', () => {
    expect(decryptFields(null, ['field'])).toBeNull();
  });

  test('maskFields decrypts and masks', () => {
    const obj = { ssn: encrypt('123456789') };
    const masked = maskFields(obj, { ssn: 4 });
    expect(masked.ssn).toBe('*****6789');
  });
});

describe('Encryption — Token Generation', () => {
  test('generateSecureToken returns hex string of expected length', () => {
    const token = generateSecureToken(32);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  test('generateSecureToken produces unique tokens', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a).not.toBe(b);
  });

  test('generateRequestId returns UUID format', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

// ── Cache Tests ──────────────────────────────────────────────

describe('Cache — In-Memory TTL Cache', () => {
  // We need to mock the database module before requiring cache
  let cache;

  beforeAll(() => {
    jest.mock('../src/config/database', () => {
      const mockDb = jest.fn(() => mockDb);
      mockDb.orderBy = jest.fn(() => Promise.resolve([{ id: 1, name: 'Test' }]));
      return { db: mockDb, config: {} };
    });
    cache = require('../src/config/cache');
  });

  afterEach(() => {
    cache.invalidateAll();
  });

  test('getOrSet caches values and returns cached on second call', async () => {
    let callCount = 0;
    const loader = async () => {
      callCount++;
      return [{ id: 1 }];
    };

    const first = await cache.getOrSet('test-key', loader);
    const second = await cache.getOrSet('test-key', loader);

    expect(first).toEqual([{ id: 1 }]);
    expect(second).toEqual([{ id: 1 }]);
    expect(callCount).toBe(1); // loader called only once
  });

  test('getOrSet re-fetches after TTL expires', async () => {
    let callCount = 0;
    const loader = async () => {
      callCount++;
      return { data: callCount };
    };

    await cache.getOrSet('expire-test', loader, 1); // 1ms TTL
    await new Promise(r => setTimeout(r, 10));
    const result = await cache.getOrSet('expire-test', loader, 1);

    expect(callCount).toBe(2);
    expect(result.data).toBe(2);
  });

  test('invalidate removes a specific key', async () => {
    let callCount = 0;
    const loader = async () => ++callCount;

    await cache.getOrSet('inv-test', loader);
    cache.invalidate('inv-test');
    await cache.getOrSet('inv-test', loader);

    expect(callCount).toBe(2);
  });

  test('invalidateAll clears entire cache', async () => {
    await cache.getOrSet('a', async () => 1);
    await cache.getOrSet('b', async () => 2);
    cache.invalidateAll();

    const stats = cache.getStats();
    expect(stats.size).toBe(0);
  });

  test('getStats returns correct counts', async () => {
    await cache.getOrSet('active1', async () => 1, 60000);
    await cache.getOrSet('active2', async () => 2, 60000);

    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.active).toBe(2);
    expect(stats.expired).toBe(0);
  });

  test('DEFAULT_TTL_MS is 5 minutes', () => {
    expect(cache.DEFAULT_TTL_MS).toBe(300000);
  });
});

// ── Circuit Breaker Tests ────────────────────────────────────

describe('Circuit Breaker', () => {
  const { CircuitBreaker, CircuitBreakerOpenError, STATES } = require('../src/config/circuitBreaker');

  let breaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      name: 'test-service',
      failureThreshold: 3,
      resetTimeoutMs: 100,
      requestTimeoutMs: 500,
    });
  });

  test('starts in CLOSED state', () => {
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });

  test('passes through successful calls in CLOSED state', async () => {
    const result = await breaker.exec(async () => 'success');
    expect(result).toBe('success');
    expect(breaker.metrics.successes).toBe(1);
    expect(breaker.state).toBe(STATES.CLOSED);
  });

  test('transitions to OPEN after failureThreshold consecutive failures', async () => {
    const fail = () => breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});

    await fail();
    await fail();
    expect(breaker.state).toBe(STATES.CLOSED);
    await fail();
    expect(breaker.state).toBe(STATES.OPEN);
    expect(breaker.metrics.failures).toBe(3);
  });

  test('rejects requests immediately when OPEN (fast fail)', async () => {
    // Force open
    for (let i = 0; i < 3; i++) {
      await breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});
    }
    expect(breaker.state).toBe(STATES.OPEN);

    await expect(breaker.exec(async () => 'ok')).rejects.toThrow(CircuitBreakerOpenError);
    expect(breaker.metrics.rejected).toBeGreaterThan(0);
  });

  test('returns fallback value when OPEN if provided', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});
    }

    const result = await breaker.exec(async () => 'ok', 'fallback-value');
    expect(result).toBe('fallback-value');
  });

  test('transitions from OPEN to HALF_OPEN after resetTimeout', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});
    }
    expect(breaker.state).toBe(STATES.OPEN);

    // Wait for reset timeout
    await new Promise(r => setTimeout(r, 150));

    // The next call should transition to HALF_OPEN and succeed
    const result = await breaker.exec(async () => 'recovered');
    expect(result).toBe('recovered');
    expect(breaker.state).toBe(STATES.CLOSED);
  });

  test('transitions HALF_OPEN → OPEN on probe failure', async () => {
    for (let i = 0; i < 3; i++) {
      await breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});
    }

    await new Promise(r => setTimeout(r, 150));

    // Probe fails
    await breaker.exec(async () => { throw new Error('still failing'); }).catch(() => {});
    expect(breaker.state).toBe(STATES.OPEN);
  });

  test('reset() forces CLOSED state', () => {
    breaker.state = STATES.OPEN;
    breaker.failureCount = 10;
    breaker.reset();
    expect(breaker.state).toBe(STATES.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });

  test('getStatus returns expected shape', () => {
    const status = breaker.getStatus();
    expect(status).toHaveProperty('name', 'test-service');
    expect(status).toHaveProperty('state', STATES.CLOSED);
    expect(status).toHaveProperty('failureCount', 0);
    expect(status.metrics).toHaveProperty('totalRequests');
    expect(status.metrics).toHaveProperty('successes');
    expect(status.metrics).toHaveProperty('failures');
    expect(status.metrics).toHaveProperty('rejected');
  });

  test('times out slow requests', async () => {
    const slowBreaker = new CircuitBreaker({
      name: 'slow',
      failureThreshold: 5,
      requestTimeoutMs: 50,
    });

    await expect(
      slowBreaker.exec(() => new Promise(resolve => setTimeout(() => resolve('late'), 200)))
    ).rejects.toThrow(/timed out/);
  });

  test('successful call resets failure count', async () => {
    await breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});
    await breaker.exec(async () => { throw new Error('fail'); }).catch(() => {});
    expect(breaker.failureCount).toBe(2);

    await breaker.exec(async () => 'success');
    expect(breaker.failureCount).toBe(0);
  });

  test('CircuitBreakerOpenError has status 503', () => {
    const err = new CircuitBreakerOpenError('test');
    expect(err.status).toBe(503);
    expect(err.name).toBe('CircuitBreakerOpenError');
    expect(err.message).toContain('test');
  });
});

describe('Circuit Breaker — Singleton Instances', () => {
  const { creditBureauBreaker, identityCheckBreaker, collateralValuationBreaker, getAllBreakerStatus } = require('../src/config/circuitBreaker');

  test('singleton breakers exist with correct names', () => {
    expect(creditBureauBreaker.name).toBe('credit-bureau');
    expect(identityCheckBreaker.name).toBe('identity-check');
    expect(collateralValuationBreaker.name).toBe('collateral-valuation');
  });

  test('getAllBreakerStatus returns array of 3 breaker statuses', () => {
    const statuses = getAllBreakerStatus();
    expect(statuses).toHaveLength(3);
    expect(statuses[0]).toHaveProperty('name');
    expect(statuses[0]).toHaveProperty('state');
    expect(statuses[0]).toHaveProperty('metrics');
  });
});
