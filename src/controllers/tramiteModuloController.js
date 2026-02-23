const service = require('../services/tramiteModuloService');

async function list(req, res) {
  try {
    const filter = {};
    if (req.query.tramite_id) filter.tramite_id = req.query.tramite_id;
    if (req.query.modulo_id) filter.modulo_id = req.query.modulo_id;
    const rows = await service.list(filter);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getOne(req, res) {
  try {
    const { tramite_id, modulo_id } = req.params;
    const row = await service.getOne(tramite_id, modulo_id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const item = await service.create(req.body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    const { tramite_id, modulo_id } = req.params;
    await service.remove(tramite_id, modulo_id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { list, getOne, create, remove };
