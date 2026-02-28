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
    rows = await db.query(
      'SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE tramite_id=? ORDER BY sort_order, id',
      [filter.tramite_id]
    );
  } else {
    rows = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos ORDER BY tramite_id, sort_order, id');
  }

  listCache.set(cacheKey, {
    rows,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return cloneRows(rows);
}

async function getById(id) {
  const res = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE id=?', [id]);
  return res[0];
}

async function create(data) {
  const { tramite_id, texto } = data;
  // Obtener el siguiente sort_order automáticamente
  const r = await db.query('SELECT MAX(sort_order) as max FROM requisitos WHERE tramite_id=?', [tramite_id]);
  const nextSort = (r[0] && r[0].max != null) ? (parseInt(r[0].max, 10) + 1) : 0;
  await db.query(
    'INSERT INTO requisitos (tramite_id, texto, sort_order) VALUES (?,?,?)',
    [tramite_id, texto, nextSort]
  );
  clearRequisitosCache();
  clearTramitesCache();
  const res = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE id = LAST_INSERT_ID()');
  return res[0];
}

async function update(id, data) {
  const { texto, sort_order } = data;
  await db.query(
    'UPDATE requisitos SET texto=?, sort_order=IFNULL(?, sort_order) WHERE id=?',
    [texto, sort_order ?? null, id]
  );
  clearRequisitosCache();
  clearTramitesCache();
  const res = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE id=?', [id]);
  return res[0];
}

async function remove(id) {
  await db.query('DELETE FROM requisitos WHERE id=?', [id]);
  clearRequisitosCache();
  clearTramitesCache();
  return;
}

module.exports = { list, getById, create, update, remove };
