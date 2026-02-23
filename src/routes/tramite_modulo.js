const express = require('express');
const router = express.Router();
const controller = require('../controllers/tramiteModuloController');

router.get('/', controller.list);
router.get('/:tramite_id/:modulo_id', controller.getOne);
router.post('/', controller.create);
router.delete('/:tramite_id/:modulo_id', controller.remove);

module.exports = router;
