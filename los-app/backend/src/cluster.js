/**
 * Cluster mode entry point — forks one worker per CPU core.
 *
 * In production, use this instead of `node src/index.js` to utilize
 * all available CPU cores. Each worker runs its own Express instance
 * sharing the same port via the OS kernel's load balancing.
 *
 * Usage:
 *   NODE_ENV=production node src/cluster.js
 *
 * Or via PM2 (preferred):
 *   pm2 start ecosystem.config.js
 *
 * Benefits for 5000+ users:
 *   - Linear throughput scaling with CPU cores
 *   - Automatic worker restart on crash (resilience)
 *   - Zero-downtime restarts during deploys
 */

const cluster = require('cluster');
const os = require('os');

const NUM_WORKERS = parseInt(process.env.CLUSTER_WORKERS, 10) || os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary process ${process.pid} starting ${NUM_WORKERS} workers...`);

  // Fork workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  // Restart crashed workers
  cluster.on('exit', (worker, code, signal) => {
    if (signal) {
      console.warn(`Worker ${worker.process.pid} killed by signal ${signal}`);
    } else if (code !== 0) {
      console.error(`Worker ${worker.process.pid} exited with code ${code} — restarting...`);
      cluster.fork();
    } else {
      console.log(`Worker ${worker.process.pid} exited gracefully`);
    }
  });

  cluster.on('online', (worker) => {
    console.log(`Worker ${worker.process.pid} is online`);
  });

  // Graceful shutdown: forward SIGTERM to all workers
  const shutdown = () => {
    console.log('Primary received shutdown signal — stopping workers...');
    for (const id in cluster.workers) {
      cluster.workers[id].process.kill('SIGTERM');
    }
    // Exit primary after workers have had time to drain
    setTimeout(() => process.exit(0), 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} else {
  // Workers run the Express application
  require('./index');
}
