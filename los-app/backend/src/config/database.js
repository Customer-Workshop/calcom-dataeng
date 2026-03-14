require('dotenv').config();

const knex = require('knex');

const config = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'los_db',
    user: process.env.DB_USER || 'los_user',
    password: process.env.DB_PASSWORD || 'los_password',
  },
  pool: { min: 2, max: 10 },
  migrations: {
    directory: '../migrations',
  },
  seeds: {
    directory: '../seeds',
  },
};

const db = knex(config);

module.exports = { db, config };
