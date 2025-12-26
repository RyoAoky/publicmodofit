const express = require('express');
const router = express.Router();
const controllerrender = require('../controllers/controllerrender');

// Páginas públicas
router.get('/', controllerrender.getHome);
router.get('/servicios', controllerrender.getServicios);
router.get('/nosotros', controllerrender.getNosotros);
router.get('/contacto', controllerrender.getContacto);

module.exports = router;


