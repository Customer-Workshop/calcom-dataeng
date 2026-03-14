/**
 * Circuit Breaker implementation for external service calls.
 *
 * Prevents cascading failures when downstream services (credit bureau,
 * identity check, collateral valuation) are slow or unavailable.
 *
 * States:
 *   CLOSED   → normal operation, requests pass through
 *   OPEN     → service is down, requests fail fast without calling the service
 *   HALF_OPEN → after reset timeout, allow one probe request to test recovery
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ name: 'credit-bureau', failureThreshold: 3 });
 *   const result = await breaker.exec(() => callCreditBureau(params));
 */

const STATES = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

class CircuitBreaker {
  /**
   * @param {Object} opts
   * @param {string}  opts.name              - Human-readable name for logging
   * @param {number}  [opts.failureThreshold=5]  - Consecutive failures before opening
   * @param {number}  [opts.resetTimeoutMs=30000] - Time in OPEN state before probing (ms)
   * @param {number}  [opts.requestTimeoutMs=10000] - Max time for a single request (ms)
   * @param {number}  [opts.halfOpenMax=1]   - Max concurrent probes in HALF_OPEN
   */
  constructor(opts) {
    this.name = opts.name || 'unnamed';
    this.failureThreshold = opts.failureThreshold || 5;
    this.resetTimeoutMs = opts.resetTimeoutMs || 30000;
    this.requestTimeoutMs = opts.requestTimeoutMs || 10000;
    this.halfOpenMax = opts.halfOpenMax || 1;

    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.halfOpenAttempts = 0;

    // Metrics for monitoring
    this.metrics = { totalRequests: 0, successes: 0, failures: 0, rejected: 0 };
  }

  /**
   * Execute a function through the circuit breaker.
   * @param {Function} fn - Async function to call
   * @param {*} [fallback] - Value to return when circuit is open (optional)
   * @returns {Promise<*>}
   */
  async exec(fn, fallback) {
    this.metrics.totalRequests++;

    if (this.state === STATES.OPEN) {
      if (this._shouldAttemptReset()) {
        this.state = STATES.HALF_OPEN;
        this.halfOpenAttempts = 0;
      } else {
        this.metrics.rejected++;
        if (fallback !== undefined) return fallback;
        throw new CircuitBreakerOpenError(this.name);
      }
    }

    if (this.state === STATES.HALF_OPEN && this.halfOpenAttempts >= this.halfOpenMax) {
      this.metrics.rejected++;
      if (fallback !== undefined) return fallback;
      throw new CircuitBreakerOpenError(this.name);
    }

    if (this.state === STATES.HALF_OPEN) {
      this.halfOpenAttempts++;
    }

    try {
      const result = await this._callWithTimeout(fn);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  /** Wrap fn in a timeout. */
  _callWithTimeout(fn) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Circuit breaker '${this.name}': request timed out after ${this.requestTimeoutMs}ms`));
      }, this.requestTimeoutMs);

      Promise.resolve(fn())
        .then((result) => { clearTimeout(timer); resolve(result); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  _onSuccess() {
    this.metrics.successes++;
    this.failureCount = 0;
    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.CLOSED;
      console.log(`Circuit breaker '${this.name}': HALF_OPEN → CLOSED (recovered)`);
    }
  }

  _onFailure() {
    this.metrics.failures++;
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = STATES.OPEN;
      console.warn(`Circuit breaker '${this.name}': CLOSED → OPEN after ${this.failureCount} failures`);
    }

    if (this.state === STATES.HALF_OPEN) {
      this.state = STATES.OPEN;
      console.warn(`Circuit breaker '${this.name}': HALF_OPEN → OPEN (probe failed)`);
    }
  }

  _shouldAttemptReset() {
    return Date.now() - this.lastFailureTime >= this.resetTimeoutMs;
  }

  /** Get current state and metrics for health/monitoring endpoints. */
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      metrics: { ...this.metrics },
    };
  }

  /** Force reset to CLOSED (for manual intervention). */
  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(name) {
    super(`Circuit breaker '${name}' is OPEN — service unavailable, failing fast`);
    this.name = 'CircuitBreakerOpenError';
    this.status = 503;
  }
}

// ── Singleton instances for each external service ────────────

const creditBureauBreaker = new CircuitBreaker({
  name: 'credit-bureau',
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  requestTimeoutMs: 10000,
});

const identityCheckBreaker = new CircuitBreaker({
  name: 'identity-check',
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  requestTimeoutMs: 10000,
});

const collateralValuationBreaker = new CircuitBreaker({
  name: 'collateral-valuation',
  failureThreshold: 3,
  resetTimeoutMs: 30000,
  requestTimeoutMs: 15000,
});

/**
 * Get status of all circuit breakers (for /api/health endpoint).
 */
function getAllBreakerStatus() {
  return [
    creditBureauBreaker.getStatus(),
    identityCheckBreaker.getStatus(),
    collateralValuationBreaker.getStatus(),
  ];
}

module.exports = {
  CircuitBreaker,
  CircuitBreakerOpenError,
  creditBureauBreaker,
  identityCheckBreaker,
  collateralValuationBreaker,
  getAllBreakerStatus,
  STATES,
};
