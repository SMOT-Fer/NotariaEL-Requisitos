const express = require('express');
const router = express.Router();

function tryMount(path, mountPath) {
	try {
		const r = require(path);
		router.use(mountPath, r);
		console.log(`Mounted API route ${mountPath} -> ${path}`);
	} catch (e) {
		console.warn(`Failed to mount ${mountPath} -> ${path}:`, e && e.message ? e.message : e);
	}
}

tryMount('./modulos', '/modulos');
tryMount('./tramites', '/tramites');
tryMount('./requisitos', '/requisitos');
tryMount('./tramite_modulo', '/tramite-modulo');
// upload is optional; mount if available
tryMount('./upload', '/upload');

module.exports = router;

// Debug helper: list mounted route paths (GET /api/_debug)
router.get('/_debug', (req, res) => {
	try {
		const routes = (router.stack || [])
			.map(layer => {
				if (layer && layer.route && layer.route.path) return layer.route.path;
				if (layer && layer.name === 'router' && layer.regexp) return (layer.regexp && layer.regexp.source) || '<router>';
				return null;
			})
			.filter(Boolean);
		res.json({ mounted: routes });
	} catch (e) {
		res.status(500).json({ error: e && e.message ? e.message : String(e) });
	}
});

