const db = require('../db');
const { clearTramitesCache } = require('./tramitesService');

const CACHE_TTL_MS = 15_000;
const listCache = new Map();

function isCacheValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

function buildCacheKey(filter = {}) {
  const tramite = filter.tramite_id != null ? String(filter.tramite_id) : '*';
  const modulo = filter.modulo_id != null ? String(filter.modulo_id) : '*';
  return `${tramite}:${modulo}`;
}

function clearTramiteModuloCache() {
  listCache.clear();
}

async function list(filter = {}) {
  const cacheKey = buildCacheKey(filter);
  const cached = listCache.get(cacheKey);
  if (isCacheValid(cached)) {
    return cached.rows.map((row) => ({ ...row }));
  }

  const whereParts = [];
  const params = [];

  if (filter && filter.tramite_id != null) {
    params.push(filter.tramite_id);
    whereParts.push('tramite_id = ?');
  }
  if (filter && filter.modulo_id != null) {
    params.push(filter.modulo_id);
    whereParts.push('modulo_id = ?');
  }

  const where = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const res = await db.query(
    `SELECT tramite_id, modulo_id
     FROM tramite_modulo
     ${where}
     ORDER BY tramite_id, modulo_id`,
    params
  );

  listCache.set(cacheKey, {
    rows: res,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return res.map((row) => ({ ...row }));
}

async function getOne(tramite_id, modulo_id) {
  const res = await db.query('SELECT * FROM tramite_modulo WHERE tramite_id=? AND modulo_id=?', [tramite_id, modulo_id]);
  return res[0];
}

async function create(data) {
  const { tramite_id, modulo_id } = data;
  await db.query('INSERT INTO tramite_modulo (tramite_id, modulo_id) VALUES (?,?)', [tramite_id, modulo_id]);
  clearTramiteModuloCache();
  clearTramitesCache();
  const res = await db.query('SELECT * FROM tramite_modulo WHERE tramite_id=? AND modulo_id=?', [tramite_id, modulo_id]);
  return res[0];
}

async function remove(tramite_id, modulo_id) {
  await db.query('DELETE FROM tramite_modulo WHERE tramite_id=? AND modulo_id=?', [tramite_id, modulo_id]);
  clearTramiteModuloCache();
  clearTramitesCache();
  return;
}

module.exports = { list, getOne, create, remove };
