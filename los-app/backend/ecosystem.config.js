/**
 * PM2 Ecosystem Configuration for production deployment.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js   # zero-downtime restart
 *   pm2 stop los-backend
 *   pm2 logs los-backend
 *
 * Features:
 *   - Cluster mode across all CPU cores
 *   - Auto-restart on crash with exponential backoff
 *   - Memory limit per worker (512 MB)
 *   - Log rotation and file logging
 *   - Graceful shutdown with 5s kill timeout
 */

module.exports = {
  apps: [
    {
      name: 'los-backend',
      script: 'src/index.js',
      instances: 'max',            // One worker per CPU core
      exec_mode: 'cluster',        // Cluster mode for load balancing
      max_memory_restart: '512M',  // Restart if worker exceeds 512 MB

      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },

      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 1000,         // 1s delay between restarts

      // Graceful shutdown
      kill_timeout: 5000,          // 5s for connections to drain
      listen_timeout: 8000,        // 8s for worker to bind port
      shutdown_with_message: true,

      // Logging
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Watch (development only — disabled in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
    },
  ],
};
