require('dotenv').config();

const knex = require('knex');

/**
 * PostgreSQL connection pool tuned for 5000+ concurrent users.
 *
 * Sizing rationale:
 *   - Each Node.js cluster worker gets its own pool
 *   - With 4 workers × 50 max connections = 200 total DB connections
 *   - PostgreSQL default max_connections is 100; increase to 300+ in postgresql.conf
 *   - Adjust POOL_MAX via env var based on available DB connections ÷ worker count
 *
 * Key settings:
 *   - acquireTimeoutMillis: fail fast if pool is exhausted (5s)
 *   - idleTimeoutMillis: reclaim idle connections after 30s
 *   - reapIntervalMillis: check for idle connections every 1s
 *   - statement_timeout: kill runaway queries after 30s
 */
const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'los_db',
    user: process.env.DB_USER || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
    // Prevent runaway queries from holding connections
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
  },
  pool: {
    min: parseInt(process.env.POOL_MIN || '5'),
    max: parseInt(process.env.POOL_MAX || '50'),
    acquireTimeoutMillis: parseInt(process.env.POOL_ACQUIRE_TIMEOUT || '5000'),
    idleTimeoutMillis: parseInt(process.env.POOL_IDLE_TIMEOUT || '30000'),
    reapIntervalMillis: 1000,
    // Log pool events for monitoring
    afterCreate: (conn, done) => {
      conn.query('SET statement_timeout TO \'30s\'', (err) => {
        if (err) console.error('Pool afterCreate error:', err.message);
        done(err, conn);
      });
    },
  },
  migrations: {
    directory: '../migrations',
  },
  seeds: {
    directory: '../seeds',
  },
};

const db = knex(config);

// Pool monitoring — log warnings when pool is near capacity
if (process.env.NODE_ENV !== 'test') {
  const pool = db.client.pool;
  if (pool) {
    setInterval(() => {
      const numUsed = pool.numUsed ? pool.numUsed() : 0;
      const numFree = pool.numFree ? pool.numFree() : 0;
      const numPending = pool.numPendingAcquires ? pool.numPendingAcquires() : 0;
      const max = config.pool.max;
      const utilization = numUsed / max;

      if (utilization > 0.8) {
        console.warn(`DB pool high utilization: ${numUsed}/${max} used, ${numFree} free, ${numPending} pending`);
      }
    }, 10000); // Check every 10 seconds
  }
}

/**
 * Get pool statistics for health/monitoring endpoints.
 */
function getPoolStats() {
  const pool = db.client.pool;
  if (!pool) return { status: 'no_pool' };
  return {
    used: pool.numUsed ? pool.numUsed() : 0,
    free: pool.numFree ? pool.numFree() : 0,
    pendingAcquires: pool.numPendingAcquires ? pool.numPendingAcquires() : 0,
    pendingCreates: pool.numPendingCreates ? pool.numPendingCreates() : 0,
    max: config.pool.max,
    min: config.pool.min,
  };
}

module.exports = { db, config, getPoolStats };
