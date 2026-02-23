require('dotenv').config();
const { Pool } = require('pg');

// Prefer DATABASE_URL, fall back to SUPABASE_URL (value from your .env)
const connectionString = process.env.DATABASE_URL;
const poolConfig = {};
if (connectionString) poolConfig.connectionString = connectionString;
// Decide about SSL: enable for supabase URLs or when explicitly requested
poolConfig.ssl = { rejectUnauthorized: false };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  // console.debug('executed query', { text, duration, rows: res.rowCount });
  return res;
}

module.exports = { query, pool };
