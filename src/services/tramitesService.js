const db = require('../db');
const fs = require('fs').promises;
const path = require('path');

const CACHE_TTL_MS = 30_000;
let listCacheEntry = null;
const byIdCache = new Map();

function isCacheValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function clearTramitesCache() {
  listCacheEntry = null;
  byIdCache.clear();
}

async function list() {
  if (isCacheValid(listCacheEntry)) {
    return cloneRows(listCacheEntry.rows);
  }
  const res = await db.query('SELECT id, titulo, icono FROM tramites ORDER BY id');
  listCacheEntry = {
    rows: res,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return cloneRows(res);
}

async function getById(id) {
  const cacheKey = String(id);
  const cached = byIdCache.get(cacheKey);
  if (isCacheValid(cached)) {
    return {
      ...cached.row,
      requisitos: cloneRows(cached.row.requisitos || []),
      modulos: cloneRows(cached.row.modulos || []),
    };
  }

  // MySQL no soporta json_agg/json_build_object, así que se hace manualmente
  const tramiteRes = await db.query('SELECT id, titulo, icono FROM tramites WHERE id = ?', [id]);
  const tramite = tramiteRes[0];
  if (!tramite) return null;
  const requisitos = await db.query('SELECT id, tramite_id, texto, sort_order FROM requisitos WHERE tramite_id = ? ORDER BY sort_order, id', [id]);
  const modulos = await db.query(
    `SELECT m.id, m.nombre, m.numero, m.piso, m.icono
     FROM tramite_modulo tm
     JOIN modulos m ON m.id = tm.modulo_id
     WHERE tm.tramite_id = ?
     ORDER BY ISNULL(m.numero), m.numero ASC, ISNULL(m.piso), m.piso ASC, m.nombre ASC, m.id ASC`,
    [id]
  );
  const result = {
    ...tramite,
    requisitos: requisitos,
    modulos: modulos,
  };
  byIdCache.set(cacheKey, {
    row: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return {
    ...result,
    requisitos: cloneRows(result.requisitos || []),
    modulos: cloneRows(result.modulos || []),
  };
}

async function create(data) {
  const { titulo, icono } = data;
  await db.query('INSERT INTO tramites (titulo, icono) VALUES (?, ?)', [titulo, icono || null]);
  clearTramitesCache();
  const res = await db.query('SELECT * FROM tramites WHERE id = LAST_INSERT_ID()');
  return res[0];
}

async function update(id, data) {
  const { titulo, icono } = data;
  await db.query('UPDATE tramites SET titulo=?, icono=? WHERE id=?', [titulo, icono || null, id]);
  clearTramitesCache();
  const res = await db.query('SELECT * FROM tramites WHERE id = ?', [id]);
  return res[0];
}

async function remove(id) {
  // try to delete associated icon file if present
  try {
    const res = await db.query('SELECT icono FROM tramites WHERE id=?', [id]);
    const row = res[0];
    if (row && row.icono) {
      const p = path.join(process.cwd(), 'public', 'icons', String(row.icono));
      try { await fs.unlink(p); } catch (e) { /* ignore missing file */ }
    }
  } catch (e) {
    // ignore
  }
  // delete requisitos rows
  try {
    await db.query('DELETE FROM requisitos WHERE tramite_id=?', [id]);
  } catch (e) { /* ignore */ }
  // delete associations
  try { await db.query('DELETE FROM tramite_modulo WHERE tramite_id=?', [id]); } catch (e) { }
  await db.query('DELETE FROM tramites WHERE id=?', [id]);
  clearTramitesCache();
  return;
}

module.exports = { list, getById, create, update, remove, clearTramitesCache };
