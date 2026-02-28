const db = require('../db');
const fs = require('fs').promises;
const path = require('path');
const { clearTramitesCache } = require('./tramitesService');

const CACHE_TTL_MS = 30_000;
let listCacheEntry = null;

function isCacheValid(entry) {
  return entry && entry.expiresAt > Date.now();
}

function clearModulosCache() {
  listCacheEntry = null;
}

async function list() {
  if (isCacheValid(listCacheEntry)) {
    return listCacheEntry.rows.map((row) => ({ ...row }));
  }
  const res = await db.query(
    `SELECT id, nombre, numero, piso, icono
     FROM modulos
     ORDER BY ISNULL(numero), numero ASC, ISNULL(piso), piso ASC, nombre ASC, id ASC`
  );
  listCacheEntry = {
    rows: res,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };
  return res.map((row) => ({ ...row }));
}

async function getById(id) {
  const res = await db.query('SELECT * FROM modulos WHERE id = ?', [id]);
  return res[0];
}

async function create(data) {
  const { nombre, numero, piso, icono } = data;
  await db.query(
    'INSERT INTO modulos (nombre, numero, piso, icono) VALUES (?,?,?,?)',
    [nombre, numero, piso || null, icono || null]
  );
  clearModulosCache();
  clearTramitesCache();
  // Obtener el registro insertado
  const res = await db.query('SELECT * FROM modulos WHERE id = LAST_INSERT_ID()');
  return res[0];
}

async function update(id, data) {
  const { nombre, numero, piso, icono } = data;
  await db.query(
    'UPDATE modulos SET nombre=?, numero=?, piso=?, icono=? WHERE id=?',
    [nombre, numero, piso || null, icono || null, id]
  );
  clearModulosCache();
  clearTramitesCache();
  // Obtener el registro actualizado
  const res = await db.query('SELECT * FROM modulos WHERE id = ?', [id]);
  return res[0];
}

async function remove(id) {
  try {
    const res = await db.query('SELECT icono FROM modulos WHERE id=?', [id]);
    const row = res[0];
    if (row && row.icono) {
      const p = path.join(process.cwd(), 'public', 'icons', String(row.icono));
      try { await fs.unlink(p); } catch (e) { /* ignore */ }
    }
  } catch (e) { }
  // remove associations where this modulo is linked
  try { await db.query('DELETE FROM tramite_modulo WHERE modulo_id=?', [id]); } catch (e) { }
  await db.query('DELETE FROM modulos WHERE id=?', [id]);
  clearModulosCache();
  clearTramitesCache();
  return;
}

module.exports = { list, getById, create, update, remove };
