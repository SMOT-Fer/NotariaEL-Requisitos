const db = require('../db');
const { clearTramitesCache } = require('./tramitesService');

const CACHE_TTL_MS = 15_000;
const listCache = new Map();

function isCacheValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function buildCacheKey(filter = {}) {
  return filter && filter.tramite_id != null ? `tramite:${filter.tramite_id}` : 'all';
}

function clearRequisitosCache() {
  listCache.clear();
}

async function list(filter) {
  const cacheKey = buildCacheKey(filter);
  const cached = listCache.get(cacheKey);
  if (isCacheValid(cached)) {
    return cloneRows(cached.rows);
  }

  let rows;
  if (filter && filter.tramite_id) {
    const res = await db.query(
      'SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE tramite_id=$1 ORDER BY sort_order, id',
      [filter.tramite_id]
    );
    rows = res.rows;
  } else {
    const res = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos ORDER BY tramite_id, sort_order, id');
    rows = res.rows;
  }

  listCache.set(cacheKey, {
    rows,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return cloneRows(rows);
}

async function getById(id) {
  const res = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE id=$1', [id]);
  return res.rows[0];
}

async function create(data) {
  const { tramite_id, texto } = data;
  // Obtener el siguiente sort_order automáticamente
  const r = await db.query('SELECT MAX(sort_order) as max FROM requisitos WHERE tramite_id=$1', [tramite_id]);
  const nextSort = (r.rows[0] && r.rows[0].max != null) ? (parseInt(r.rows[0].max, 10) + 1) : 0;
  const res = await db.query(
    'INSERT INTO requisitos (tramite_id, texto, sort_order) VALUES ($1,$2,$3) RETURNING id, tramite_id, texto, sort_order',
    [tramite_id, texto, nextSort]
  );
  clearRequisitosCache();
  clearTramitesCache();
  return res.rows[0];
}

async function update(id, data) {
  const { texto, sort_order } = data;
  const res = await db.query(
    'UPDATE requisitos SET texto=$1, sort_order=COALESCE($2, sort_order) WHERE id=$3 RETURNING id, tramite_id, texto, sort_order',
    [texto, sort_order ?? null, id]
  );
  clearRequisitosCache();
  clearTramitesCache();
  return res.rows[0];
}

async function remove(id) {
  await db.query('DELETE FROM requisitos WHERE id=$1', [id]);
  clearRequisitosCache();
  clearTramitesCache();
  return;
}

module.exports = { list, getById, create, update, remove };
