const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../lib/auth');
const controllerrender = require('../controllers/controllerrender');
const controllerdashboard = require('../controllers/controllerdashboard');

// Render de vistas
router.get('/', isLoggedIn, controllerrender.getDashboard);
router.get('/perfil', isLoggedIn, controllerrender.getPerfil);
router.get('/membresias', isLoggedIn, controllerrender.getMembresias);
router.get('/pedidos', isLoggedIn, controllerrender.getPedidos);

// API - Obtener datos
router.get('/api/data', isLoggedIn, controllerdashboard.getDashboardData);
router.get('/api/membresias', isLoggedIn, controllerdashboard.getMembresiasData);
router.get('/api/pedidos', isLoggedIn, controllerdashboard.getPedidosData);
router.get('/api/pedido/:id', isLoggedIn, controllerdashboard.getPedidoDetalle);

// API - Procesar formularios
router.post('/perfil', isLoggedIn, controllerdashboard.postActualizarPerfil);
router.post('/cambiar-password', isLoggedIn, controllerdashboard.postCambiarPassword);

module.exports = router;
