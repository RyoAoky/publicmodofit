const express = require('express');
const router = express.Router();
const { isLoggedIn, isNotLoggedIn } = require('../lib/auth');
const controllerrender = require('../controllers/controllerrender');
const controllerauth = require('../controllers/controllerauth');

// Render de vistas
router.get('/login', isNotLoggedIn, controllerrender.getLogin);
router.get('/registro', isNotLoggedIn, controllerrender.getRegistro);
router.get('/recuperar', isNotLoggedIn, controllerrender.getRecuperar);

// API - Obtener usuario actual
router.get('/api/me', controllerauth.getMe);

// Procesar formularios
router.post('/login', isNotLoggedIn, controllerauth.postLogin);
router.post('/recuperar', isNotLoggedIn, controllerauth.postRecuperar);

// Cerrar sesión
router.get('/logout', controllerauth.getLogout);

module.exports = router;
