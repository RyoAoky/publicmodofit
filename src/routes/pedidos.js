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
router.get('/api/confirmacion/:id', controllerpedidos.getConfirmacionData);
router.get('/api/estado-pago/:transactionId', controllerpedidos.getEstadoPago);

// API - Verificaciones y validaciones
router.get('/api/verificar-membresia/:dni', controllerpedidos.getVerificarMembresia);
router.get('/api/historial-suscripciones/:dni', controllerpedidos.getHistorialSuscripciones);
router.get('/api/health', controllerpedidos.getHealthCheck);
router.post('/api/validar-documento', controllerpedidos.postValidarDocumento);

// API - Procesar pago con tarjeta (cobro único)
router.post('/api/procesar-pago', controllerpedidos.postProcesarPago);

// API - Procesar suscripción (flujo completo OpenPay)
router.post('/api/procesar-suscripcion', controllerpedidos.postProcesarSuscripcion);

module.exports = router;
