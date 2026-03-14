/**
 * In-memory JWT token blacklist for immediate token revocation on logout.
 *
 * In production, replace with Redis or a database-backed store for
 * persistence across server restarts and horizontal scaling.
 *
 * Tokens are stored with their expiration time and automatically pruned
 * to prevent unbounded memory growth.
 */

const blacklistedTokens = new Map();

const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // Prune expired entries every hour

/**
 * Add a token to the blacklist. The token will be automatically removed
 * after it would have expired naturally.
 *
 * @param {string} token - The JWT token string to blacklist
 * @param {number} expiresAt - Unix timestamp (seconds) when the token expires
 */
function blacklistToken(token, expiresAt) {
  if (!token) return;
  blacklistedTokens.set(token, expiresAt);
}

/**
 * Check if a token has been blacklisted (i.e., the user logged out).
 *
 * @param {string} token - The JWT token to check
 * @returns {boolean} True if the token is blacklisted
 */
function isTokenBlacklisted(token) {
  if (!token) return false;
  return blacklistedTokens.has(token);
}

/**
 * Remove expired tokens from the blacklist to free memory.
 * Called periodically via setInterval.
 */
function pruneExpiredTokens() {
  const now = Math.floor(Date.now() / 1000);
  let pruned = 0;
  for (const [token, expiresAt] of blacklistedTokens.entries()) {
    if (expiresAt <= now) {
      blacklistedTokens.delete(token);
      pruned++;
    }
  }
  if (pruned > 0) {
    console.log(`Token blacklist: pruned ${pruned} expired entries, ${blacklistedTokens.size} remaining`);
  }
}

/**
 * Get the current size of the blacklist (for monitoring).
 *
 * @returns {number} Number of blacklisted tokens
 */
function getBlacklistSize() {
  return blacklistedTokens.size;
}

/**
 * Clear the entire blacklist (for testing).
 */
function clearBlacklist() {
  blacklistedTokens.clear();
}

// Start periodic pruning (only in non-test environments)
if (process.env.NODE_ENV !== 'test') {
  setInterval(pruneExpiredTokens, PRUNE_INTERVAL_MS);
}

module.exports = {
  blacklistToken,
  isTokenBlacklisted,
  pruneExpiredTokens,
  getBlacklistSize,
  clearBlacklist,
};
