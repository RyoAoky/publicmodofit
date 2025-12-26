const express = require('express');
const router = express.Router();
const controllerrender = require('../controllers/controllerrender');
const controllerpedidos = require('../controllers/controllerpedidos');

// Render de vistas
router.get('/', controllerrender.getCatalogo);
router.get('/carrito', controllerrender.getCarrito);
router.get('/checkout', controllerrender.getCheckout);
router.get('/confirmacion', controllerrender.getConfirmacion);

// API - Obtener datos
router.get('/api/productos', controllerpedidos.getProductos);
router.get('/api/membresias', controllerpedidos.getMembresias);
router.get('/api/openpay-config', controllerpedidos.getOpenpayConfig);
router.get('/api/confirmacion/:id', controllerpedidos.getConfirmacionData);
router.get('/api/estado-pago/:transactionId', controllerpedidos.getEstadoPago);

// API - Procesar pago con tarjeta
router.post('/api/procesar-pago', controllerpedidos.postProcesarPago);

module.exports = router;
