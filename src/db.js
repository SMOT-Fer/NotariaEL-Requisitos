require('dotenv').config();
const mysql = require('mysql2/promise');

const connectionString = process.env.DATABASE_URL;

const pool = mysql.createPool({
  uri: connectionString,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.on?.('error', (err) => {
  console.error('Unexpected MySQL pool error', err);
});

async function query(sql, params) {
  const start = Date.now();
  const [rows] = await pool.execute(sql, params);
  const duration = Date.now() - start;
  // console.debug('executed query', { sql, duration });
  return rows;
}

module.exports = { query, pool };