/**
 * In-memory cache layer for frequently accessed, rarely-changed data.
 *
 * Caches loan products, branches, state rules, and roles to avoid
 * hitting the database on every request. These tables change infrequently
 * (admin updates only) and are read on nearly every API call.
 *
 * For horizontal scaling beyond a single server, replace with Redis.
 *
 * Design:
 *  - TTL-based expiration (default 5 minutes)
 *  - Manual invalidation on admin writes
 *  - Lazy loading on first access
 *  - Thread-safe (single-threaded Node, but safe across async ops)
 */

const { db } = require('./database');

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

const store = new Map();

/**
 * Generic get-or-set: returns cached value if fresh, otherwise calls loader.
 * @param {string} key - Cache key
 * @param {Function} loader - Async function that fetches the data
 * @param {number} [ttl] - Time-to-live in milliseconds
 * @returns {Promise<*>} Cached or freshly loaded value
 */
async function getOrSet(key, loader, ttl = DEFAULT_TTL_MS) {
  const entry = store.get(key);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.value;
  }
  const value = await loader();
  store.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

/**
 * Invalidate a single cache key (call after admin updates).
 */
function invalidate(key) {
  store.delete(key);
}

/**
 * Invalidate all cache entries.
 */
function invalidateAll() {
  store.clear();
}

/**
 * Get cache stats for monitoring / health endpoints.
 */
function getStats() {
  let active = 0;
  let expired = 0;
  const now = Date.now();
  for (const entry of store.values()) {
    if (now < entry.expiresAt) active++;
    else expired++;
  }
  return { size: store.size, active, expired };
}

// ── Pre-built loaders for common reference data ──────────────

async function getLoanProducts() {
  return getOrSet('loan_products', () =>
    db('loan_products').orderBy('name')
  );
}

async function getBranches() {
  return getOrSet('branches', () =>
    db('branches').orderBy('name')
  );
}

async function getRoles() {
  return getOrSet('roles', () =>
    db('roles').orderBy('id')
  );
}

async function getStateRules() {
  return getOrSet('state_rules', () =>
    db('state_rules').orderBy('state')
  );
}

/**
 * Get a single state rule by state code (uses the full list cache).
 */
async function getStateRule(stateCode) {
  const rules = await getStateRules();
  return rules.find((r) => r.state === stateCode) || null;
}

module.exports = {
  getOrSet,
  invalidate,
  invalidateAll,
  getStats,
  getLoanProducts,
  getBranches,
  getRoles,
  getStateRules,
  getStateRule,
  DEFAULT_TTL_MS,
};
