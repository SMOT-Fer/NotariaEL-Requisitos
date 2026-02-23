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
    rows: res.rows,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return cloneRows(res.rows);
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

  const res = await db.query(`
    SELECT
      t.id,
      t.titulo,
      t.icono,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', r.id,
            'tramite_id', r.tramite_id,
            'texto', r.texto,
            'sort_order', r.sort_order
          )
          ORDER BY r.sort_order, r.id
        )
        FROM requisitos r
        WHERE r.tramite_id = t.id
      ), '[]'::json) AS requisitos,
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', m.id,
            'nombre', m.nombre,
            'numero', m.numero,
            'piso', m.piso,
            'icono', m.icono
          )
          ORDER BY
            m.numero ASC NULLS LAST,
            m.piso ASC NULLS LAST,
            m.nombre ASC,
            m.id ASC
        )
        FROM tramite_modulo tm
        JOIN modulos m ON m.id = tm.modulo_id
        WHERE tm.tramite_id = t.id
      ), '[]'::json) AS modulos
    FROM tramites t
    WHERE t.id = $1
  `, [id]);
  const row = res.rows[0];
  if (!row) return null;

  const result = {
    ...row,
    requisitos: Array.isArray(row.requisitos) ? row.requisitos : [],
    modulos: Array.isArray(row.modulos) ? row.modulos : [],
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
  const res = await db.query(
    'INSERT INTO tramites (titulo, icono) VALUES ($1,$2) RETURNING *',
    [titulo, icono || null]
  );
  clearTramitesCache();
  return res.rows[0];
}

async function update(id, data) {
  const { titulo, icono } = data;
  const res = await db.query(
    'UPDATE tramites SET titulo=$1, icono=$2 WHERE id=$3 RETURNING *',
    [titulo, icono || null, id]
  );
  clearTramitesCache();
  return res.rows[0];
}

async function remove(id) {
  // try to delete associated icon file if present
  try {
    const res = await db.query('SELECT icono FROM tramites WHERE id=$1', [id]);
    const row = res.rows[0];
    if (row && row.icono) {
      const p = path.join(process.cwd(), 'public', 'icons', String(row.icono));
      try { await fs.unlink(p); } catch (e) { /* ignore missing file */ }
    }
  } catch (e) {
    // ignore
  }
  // delete requisitos rows
  try {
    await db.query('DELETE FROM requisitos WHERE tramite_id=$1', [id]);
  } catch (e) { /* ignore */ }
  // delete associations
  try { await db.query('DELETE FROM tramite_modulo WHERE tramite_id=$1', [id]); } catch (e) { }
  await db.query('DELETE FROM tramites WHERE id=$1', [id]);
  clearTramitesCache();
  return;
}

module.exports = { list, getById, create, update, remove, clearTramitesCache };
