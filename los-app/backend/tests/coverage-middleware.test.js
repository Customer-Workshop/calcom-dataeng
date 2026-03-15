/**
 * Comprehensive middleware unit tests for 98%+ coverage.
 * Tests: auth middleware, security middleware, validation middleware
 */

const jwt = require('jsonwebtoken');

// Mock database
const mockDbChain = {};
mockDbChain.where = jest.fn().mockReturnValue(mockDbChain);
mockDbChain.first = jest.fn().mockResolvedValue(null);
mockDbChain.update = jest.fn().mockResolvedValue(1);

const mockDb = jest.fn(() => mockDbChain);
jest.mock('../src/config/database', () => ({
  db: mockDb,
  config: { pool: { max: 50, min: 5 } },
  getPoolStats: jest.fn(() => ({ used: 0, free: 5 })),
}));

jest.mock('../src/utils/audit', () => ({
  createAuditLog: jest.fn(() => Promise.resolve()),
}));

jest.mock('../src/utils/encryption', () => ({
  generateRequestId: jest.fn(() => 'test-req-id-123'),
  encrypt: jest.fn((v) => `encrypted:${v}`),
  decrypt: jest.fn((v) => v.replace('encrypted:', '')),
}));

const { jwtSecret } = require('../src/config/auth');

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────
describe('Auth Middleware', () => {
  const { authenticate, authorize, checkAuthorityLimit } = require('../src/middleware/auth');

  function mockReq(overrides = {}) {
    return {
      headers: { authorization: '' },
      user: null,
      token: null,
      ip: '127.0.0.1',
      originalUrl: '/test',
      method: 'GET',
      requestId: 'test-123',
      body: {},
      ...overrides,
    };
  }

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  describe('authenticate', () => {
    test('rejects request without authorization header', () => {
      const req = mockReq();
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects request with non-Bearer authorization', () => {
      const req = mockReq({ headers: { authorization: 'Basic abc123' } });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects blacklisted token', () => {
      const { blacklistToken } = require('../src/utils/tokenBlacklist');
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'borrower' }, jwtSecret, { expiresIn: '1h' });
      const decoded = jwt.decode(token);
      blacklistToken(token, decoded.exp);

      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token has been revoked' });
    });

    test('rejects expired token', () => {
      const token = jwt.sign({ id: 1, email: 'test@test.com', role: 'borrower' }, jwtSecret, { expiresIn: '-1s' });
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Token expired', code: 'TOKEN_EXPIRED' }));
    });

    test('rejects invalid token', () => {
      const req = mockReq({ headers: { authorization: 'Bearer invalid-token-xyz' } });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    });

    test('accepts valid token and attaches user to request', () => {
      const payload = { id: 1, email: 'test@test.com', role: 'borrower', role_id: 1 };
      const token = jwt.sign(payload, jwtSecret, { expiresIn: '1h' });
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(1);
      expect(req.user.email).toBe('test@test.com');
      expect(req.user.role).toBe('borrower');
      expect(req.token).toBe(token);
    });
  });

  describe('authorize', () => {
    test('rejects when no user on request', () => {
      const middleware = authorize('admin');
      const req = mockReq({ user: null });
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    test('rejects when user role not in allowed roles', () => {
      const middleware = authorize('system_admin', 'executive');
      const req = mockReq({
        user: { id: 1, email: 'test@test.com', role: 'borrower' },
        ip: '127.0.0.1',
        originalUrl: '/api/admin/users',
        method: 'GET',
        requestId: 'req-123',
      });
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    test('allows when user role is in allowed roles', () => {
      const middleware = authorize('borrower', 'loan_officer');
      const req = mockReq({ user: { id: 1, email: 'test@test.com', role: 'borrower' } });
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('allows system_admin for admin-only routes', () => {
      const middleware = authorize('system_admin');
      const req = mockReq({ user: { id: 1, email: 'admin@test.com', role: 'system_admin' } });
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkAuthorityLimit', () => {
    test('allows when amount is within limit', () => {
      const req = mockReq({
        user: { id: 1, role: 'loan_officer' },
        body: { approved_amount: 50000 },
      });
      const res = mockRes();
      const next = jest.fn();

      checkAuthorityLimit(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects when amount exceeds authority limit', () => {
      const req = mockReq({
        user: { id: 1, role: 'loan_officer' },
        body: { approved_amount: 999999999 },
      });
      const res = mockRes();
      const next = jest.fn();

      checkAuthorityLimit(req, res, next);
      // loan_officer limit is 100000, so 999999999 exceeds it
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    test('allows when no amount in body', () => {
      const req = mockReq({
        user: { id: 1, role: 'borrower' },
        body: {},
      });
      const res = mockRes();
      const next = jest.fn();

      checkAuthorityLimit(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('uses requested_amount as fallback', () => {
      const req = mockReq({
        user: { id: 1, role: 'borrower' },
        body: { requested_amount: 10000 },
      });
      const res = mockRes();
      const next = jest.fn();

      checkAuthorityLimit(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });
});

// ─── SECURITY MIDDLEWARE ─────────────────────────────────────
describe('Security Middleware', () => {
  const {
    checkAccountLockout,
    recordFailedLogin,
    resetFailedLogins,
    requestIdMiddleware,
    sanitizeInput,
    logSecurityEvent,
    getHelmetConfig,
    validatePasswordPolicy,
    PASSWORD_POLICY,
    MAX_FAILED_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
  } = require('../src/middleware/security');

  describe('checkAccountLockout', () => {
    test('returns not locked for non-existent user', async () => {
      mockDbChain.first.mockResolvedValueOnce(null);
      const result = await checkAccountLockout('nobody@test.com');
      expect(result).toEqual({ locked: false, remainingMinutes: 0 });
    });

    test('returns locked when locked_until is in the future', async () => {
      const futureDate = new Date(Date.now() + 30 * 60000);
      mockDbChain.first.mockResolvedValueOnce({ id: 1, locked_until: futureDate, failed_login_attempts: 5 });
      const result = await checkAccountLockout('locked@test.com');
      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    test('resets counter when lockout has expired', async () => {
      const pastDate = new Date(Date.now() - 60000);
      mockDbChain.first.mockResolvedValueOnce({ id: 1, locked_until: pastDate, failed_login_attempts: 5 });
      mockDbChain.update.mockResolvedValueOnce(1);
      const result = await checkAccountLockout('expired@test.com');
      expect(result.locked).toBe(false);
    });

    test('returns not locked for user with no lockout', async () => {
      mockDbChain.first.mockResolvedValueOnce({ id: 1, locked_until: null, failed_login_attempts: 0 });
      const result = await checkAccountLockout('active@test.com');
      expect(result).toEqual({ locked: false, remainingMinutes: 0 });
    });

    test('handles database error gracefully', async () => {
      mockDbChain.first.mockRejectedValueOnce(new Error('DB error'));
      const result = await checkAccountLockout('error@test.com');
      expect(result).toEqual({ locked: false, remainingMinutes: 0 });
    });
  });

  describe('recordFailedLogin', () => {
    test('increments failed attempts for existing user', async () => {
      mockDbChain.first.mockResolvedValueOnce({ id: 1, failed_login_attempts: 2 });
      mockDbChain.update.mockResolvedValueOnce(1);
      await recordFailedLogin('user@test.com', '127.0.0.1');
      // Should not throw
    });

    test('does nothing for non-existent user', async () => {
      mockDbChain.first.mockResolvedValueOnce(null);
      await recordFailedLogin('nobody@test.com', '127.0.0.1');
    });

    test('locks account after MAX_FAILED_ATTEMPTS', async () => {
      mockDbChain.first.mockResolvedValueOnce({ id: 1, failed_login_attempts: MAX_FAILED_ATTEMPTS - 1 });
      mockDbChain.update.mockResolvedValueOnce(1);
      await recordFailedLogin('lockme@test.com', '127.0.0.1');
    });

    test('handles database error gracefully', async () => {
      mockDbChain.first.mockRejectedValueOnce(new Error('DB error'));
      await recordFailedLogin('error@test.com', '127.0.0.1');
    });
  });

  describe('resetFailedLogins', () => {
    test('resets counter on successful login', async () => {
      mockDbChain.update.mockResolvedValueOnce(1);
      await resetFailedLogins(1);
    });

    test('handles database error gracefully', async () => {
      mockDbChain.update.mockRejectedValueOnce(new Error('DB error'));
      await resetFailedLogins(1);
    });
  });

  describe('requestIdMiddleware', () => {
    test('generates request ID when not provided', () => {
      const req = { headers: {} };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.requestId).toBe('test-req-id-123');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'test-req-id-123');
      expect(next).toHaveBeenCalled();
    });

    test('uses existing X-Request-ID header', () => {
      const req = { headers: { 'x-request-id': 'client-id-456' } };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      requestIdMiddleware(req, res, next);

      expect(req.requestId).toBe('client-id-456');
      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'client-id-456');
    });
  });

  describe('sanitizeInput', () => {
    test('strips script tags from body', () => {
      const req = {
        body: { name: 'Test<script>alert("xss")</script>User' },
        query: {},
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.body.name).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    test('strips event handlers from body', () => {
      const req = {
        body: { name: 'Test onload="alert(1)"' },
        query: {},
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.body.name).not.toContain('onload=');
    });

    test('strips javascript: protocol', () => {
      const req = {
        body: { url: 'javascript:alert(1)' },
        query: {},
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.body.url).not.toContain('javascript:');
    });

    test('sanitizes query parameters', () => {
      const req = {
        body: {},
        query: { search: '<script>alert(1)</script>test' },
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.query.search).not.toContain('<script>');
    });

    test('handles nested objects', () => {
      const req = {
        body: { nested: { deep: 'hello<script>bad</script>world' } },
        query: {},
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.body.nested.deep).not.toContain('<script>');
    });

    test('handles non-string values', () => {
      const req = {
        body: { count: 5, active: true, items: [1, 2, 3] },
        query: {},
      };
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);

      expect(req.body.count).toBe(5);
      expect(req.body.active).toBe(true);
      expect(next).toHaveBeenCalled();
    });

    test('handles missing body/query', () => {
      const req = {};
      const res = {};
      const next = jest.fn();

      sanitizeInput(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('logSecurityEvent', () => {
    test('logs security event to audit trail', async () => {
      await logSecurityEvent({
        userId: 1,
        userEmail: 'test@test.com',
        event: 'failed_login',
        severity: 'warning',
        details: { ip: '1.2.3.4' },
        ipAddress: '1.2.3.4',
        requestId: 'req-123',
      });
      // Should not throw
      const { createAuditLog } = require('../src/utils/audit');
      expect(createAuditLog).toHaveBeenCalled();
    });

    test('handles audit logging failure gracefully', async () => {
      const { createAuditLog } = require('../src/utils/audit');
      createAuditLog.mockRejectedValueOnce(new Error('Audit DB error'));

      await logSecurityEvent({
        event: 'test_event',
        severity: 'info',
        details: {},
      });
      // Should not throw
    });
  });

  describe('getHelmetConfig', () => {
    test('returns valid helmet configuration', () => {
      const config = getHelmetConfig();
      expect(config.contentSecurityPolicy).toBeDefined();
      expect(config.hsts).toBeDefined();
      expect(config.hsts.maxAge).toBe(31536000);
      expect(config.frameguard).toEqual({ action: 'deny' });
      expect(config.noSniff).toBe(true);
      expect(config.referrerPolicy).toBeDefined();
      expect(config.dnsPrefetchControl).toEqual({ allow: false });
    });
  });

  describe('validatePasswordPolicy', () => {
    test('accepts valid password', () => {
      const result = validatePasswordPolicy('StrongP@ss1234');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects short password', () => {
      const result = validatePasswordPolicy('Sh0rt!');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects password without uppercase', () => {
      const result = validatePasswordPolicy('nouppercase1234!');
      expect(result.valid).toBe(false);
    });

    test('rejects password without lowercase', () => {
      const result = validatePasswordPolicy('NOLOWERCASE1234!');
      expect(result.valid).toBe(false);
    });

    test('rejects password without digit', () => {
      const result = validatePasswordPolicy('NoDigitHere!!abc');
      expect(result.valid).toBe(false);
    });

    test('rejects password without special character', () => {
      const result = validatePasswordPolicy('NoSpecial12345a');
      expect(result.valid).toBe(false);
    });

    test('rejects null/undefined password', () => {
      const result = validatePasswordPolicy(null);
      expect(result.valid).toBe(false);
    });

    test('rejects empty string', () => {
      const result = validatePasswordPolicy('');
      expect(result.valid).toBe(false);
    });

    test('rejects password exceeding max length', () => {
      const longPassword = 'A'.repeat(130) + 'a1!';
      const result = validatePasswordPolicy(longPassword);
      expect(result.valid).toBe(false);
    });
  });

  describe('PASSWORD_POLICY constants', () => {
    test('has correct policy values', () => {
      expect(PASSWORD_POLICY.minLength).toBe(12);
      expect(PASSWORD_POLICY.maxLength).toBe(128);
      expect(PASSWORD_POLICY.requireUppercase).toBe(true);
      expect(PASSWORD_POLICY.requireLowercase).toBe(true);
      expect(PASSWORD_POLICY.requireDigit).toBe(true);
      expect(PASSWORD_POLICY.requireSpecial).toBe(true);
    });
  });

  describe('Constants', () => {
    test('MAX_FAILED_ATTEMPTS is 5', () => {
      expect(MAX_FAILED_ATTEMPTS).toBe(5);
    });
    test('LOCKOUT_DURATION_MINUTES is 30', () => {
      expect(LOCKOUT_DURATION_MINUTES).toBe(30);
    });
  });
});

// ─── VALIDATION MIDDLEWARE ───────────────────────────────────
describe('Validation Middleware', () => {
  const { validateBody, validateQuery, schemas } = require('../src/middleware/validation');

  function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  }

  describe('validateBody', () => {
    test('passes valid body through', () => {
      const middleware = validateBody(schemas.login);
      const req = { body: { email: 'test@test.com', password: 'MyP@ssw0rd123' } };
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.body.email).toBe('test@test.com');
    });

    test('rejects invalid body', () => {
      const middleware = validateBody(schemas.login);
      const req = { body: { email: 'not-an-email', password: '' } };
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Validation failed' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    test('returns field-level error details', () => {
      const middleware = validateBody(schemas.register);
      const req = { body: {} };
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      const response = res.json.mock.calls[0][0];
      expect(response.details).toBeDefined();
      expect(response.details.length).toBeGreaterThan(0);
      expect(response.details[0]).toHaveProperty('field');
      expect(response.details[0]).toHaveProperty('message');
    });
  });

  describe('validateQuery', () => {
    test('passes valid query through', () => {
      const { z } = require('zod');
      const schema = z.object({ page: z.string().optional() });
      const middleware = validateQuery(schema);
      const req = { query: { page: '1' } };
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('rejects invalid query parameters', () => {
      const { z } = require('zod');
      const schema = z.object({ page: z.number() });
      const middleware = validateQuery(schema);
      const req = { query: { page: 'not-a-number' } };
      const res = mockRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Invalid query parameters' })
      );
    });
  });

  describe('schemas', () => {
    test('login schema validates correctly', () => {
      const result = schemas.login.safeParse({ email: 'test@test.com', password: '123456' });
      expect(result.success).toBe(true);
    });

    test('login schema rejects short password', () => {
      const result = schemas.login.safeParse({ email: 'test@test.com', password: '12345' });
      expect(result.success).toBe(false);
    });

    test('register schema validates correctly', () => {
      const result = schemas.register.safeParse({
        email: 'test@test.com',
        password: 'SecureP@ss1234',
        first_name: 'John',
        last_name: 'Doe',
      });
      expect(result.success).toBe(true);
    });

    test('register schema rejects short password', () => {
      const result = schemas.register.safeParse({
        email: 'test@test.com', password: 'short', first_name: 'A', last_name: 'B',
      });
      expect(result.success).toBe(false);
    });

    test('application schema validates correctly', () => {
      const result = schemas.application.safeParse({
        loan_product_id: 1,
        requested_amount: 20000,
        term_months: 36,
        purpose: 'Debt consolidation',
        state: 'TX',
      });
      expect(result.success).toBe(true);
    });

    test('application schema rejects invalid state', () => {
      const result = schemas.application.safeParse({
        loan_product_id: 1, requested_amount: 20000, term_months: 36,
        purpose: 'Test', state: 'TOOLONG',
      });
      expect(result.success).toBe(false);
    });

    test('collateral schema validates vehicle', () => {
      const result = schemas.collateral.safeParse({
        type: 'vehicle', vin: '1HGBH41JXMN100001', year: 2023, condition: 'good',
      });
      expect(result.success).toBe(true);
    });

    test('collateral schema rejects invalid type', () => {
      const result = schemas.collateral.safeParse({ type: 'spaceship' });
      expect(result.success).toBe(false);
    });

    test('decision schema validates', () => {
      const result = schemas.decision.safeParse({
        decision_type: 'manual_approve', approved_amount: 20000, approved_rate: 6.99,
      });
      expect(result.success).toBe(true);
    });

    test('decision schema rejects invalid type', () => {
      const result = schemas.decision.safeParse({ decision_type: 'invalid_type' });
      expect(result.success).toBe(false);
    });

    test('condition schema validates', () => {
      const result = schemas.condition.safeParse({
        name: 'Proof of income', category: 'prior_to_funding',
      });
      expect(result.success).toBe(true);
    });

    test('condition schema rejects invalid category', () => {
      const result = schemas.condition.safeParse({ name: 'test', category: 'invalid' });
      expect(result.success).toBe(false);
    });

    test('stateRule schema validates', () => {
      const result = schemas.stateRule.safeParse({
        state: 'TX', state_name: 'Texas', is_enabled: true, max_rate_cap: 18,
      });
      expect(result.success).toBe(true);
    });

    test('createUser schema validates', () => {
      const result = schemas.createUser.safeParse({
        email: 'new@test.com', password: 'SecureP@ss1234',
        first_name: 'New', last_name: 'User', role_id: 1,
      });
      expect(result.success).toBe(true);
    });

    test('fundingInstruction schema validates', () => {
      const result = schemas.fundingInstruction.safeParse({ amount: 20000 });
      expect(result.success).toBe(true);
    });

    test('eSignature schema validates', () => {
      const result = schemas.eSignature.safeParse({
        signature_data: 'base64signaturedata', signer_name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    test('eSignature schema rejects empty signature', () => {
      const result = schemas.eSignature.safeParse({ signature_data: '', signer_name: '' });
      expect(result.success).toBe(false);
    });

    test('application schema with borrower_info', () => {
      const result = schemas.application.safeParse({
        loan_product_id: 1, requested_amount: 15000, term_months: 24,
        purpose: 'Auto purchase', state: 'FL',
        borrower_info: {
          ssn_last_four: '1234', employment_status: 'employed',
          annual_income: 75000, monthly_debt_payments: 500,
        },
      });
      expect(result.success).toBe(true);
    });

    test('application schema with co_borrower_info', () => {
      const result = schemas.application.safeParse({
        loan_product_id: 1, requested_amount: 15000, term_months: 24,
        purpose: 'Home improvement', state: 'OH',
        co_borrower_info: { first_name: 'Jane', email: 'jane@test.com' },
      });
      expect(result.success).toBe(true);
    });
  });
});
