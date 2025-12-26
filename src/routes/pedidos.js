const express = require('express');
const router = express.Router();
const { sequelize, QueryTypes } = require('../database/conexionsqualize');

// Lista de productos/servicios para comprar
router.get('/', async (req, res) => {
    try {
        // Obtener productos disponibles
        const productos = await sequelize.query(
            `SELECT * FROM Producto WHERE estpro = 'A' ORDER BY nompro`,
            { type: QueryTypes.SELECT }
        );

        // Obtener membresías disponibles
        const tiposMembresia = await sequelize.query(
            `SELECT * FROM TipoMembresia WHERE esttm = 'A' ORDER BY pretm`,
            { type: QueryTypes.SELECT }
        );

        res.render('pedidos/index', {
            layout: 'public',
            title: 'Realizar Pedido - ModoFit',
            productos: productos || [],
            tiposMembresia: tiposMembresia || [],
            user: req.user || null
        });
    } catch (error) {
        console.error('Error al cargar pedidos:', error);
        res.render('pedidos/index', {
            layout: 'public',
            title: 'Realizar Pedido - ModoFit',
            productos: [],
            tiposMembresia: [],
            user: req.user || null
        });
    }
});

// Ver carrito
router.get('/carrito', (req, res) => {
    res.render('pedidos/carrito', {
        layout: 'public',
        title: 'Mi Carrito - ModoFit',
        user: req.user || null
    });
});

// Página de checkout/pago
router.get('/checkout', (req, res) => {
    res.render('pedidos/checkout', {
        layout: 'public',
        title: 'Finalizar Compra - ModoFit',
        user: req.user || null
    });
});

// Procesar pago (API)
router.post('/procesar-pago', async (req, res) => {
    try {
        const { items, metodoPago, datosCliente, total } = req.body;
        
        // Aquí iría la integración con la pasarela de pagos
        // Por ahora solo guardamos el pedido
        
        const idCliente = req.user ? req.user.idcli : null;

        // Crear el pedido
        const resultPedido = await sequelize.query(
            `INSERT INTO Pedido (idcli, totped, metpagped, estped, fecped) 
             OUTPUT INSERTED.idped
             VALUES (:idCliente, :total, :metodoPago, 'P', GETDATE())`,
            {
                replacements: { 
                    idCliente, 
                    total, 
                    metodoPago 
                },
                type: QueryTypes.INSERT
            }
        );

        const idPedido = resultPedido[0]?.idped;

        // Insertar items del pedido
        for (const item of items) {
            await sequelize.query(
                `INSERT INTO DetallePedido (idped, idpro, cantdp, predp) 
                 VALUES (:idPedido, :idProducto, :cantidad, :precio)`,
                {
                    replacements: { 
                        idPedido, 
                        idProducto: item.id, 
                        cantidad: item.cantidad, 
                        precio: item.precio 
                    },
                    type: QueryTypes.INSERT
                }
            );
        }

        res.json({ 
            success: true, 
            message: 'Pedido registrado correctamente',
            idPedido 
        });

    } catch (error) {
        console.error('Error al procesar pago:', error);
        res.json({ 
            success: false, 
            message: 'Error al procesar el pago' 
        });
    }
});

// Confirmación de pedido
router.get('/confirmacion/:id', async (req, res) => {
    try {
        const idPedido = req.params.id;
        
        const pedido = await sequelize.query(
            `SELECT * FROM Pedido WHERE idped = :idPedido`,
            {
                replacements: { idPedido },
                type: QueryTypes.SELECT
            }
        );

        res.render('pedidos/confirmacion', {
            layout: 'public',
            title: 'Pedido Confirmado - ModoFit',
            pedido: pedido[0] || null,
            user: req.user || null
        });
    } catch (error) {
        console.error('Error al cargar confirmación:', error);
        res.redirect('/pedidos');
    }
});

// API para obtener productos
router.get('/api/productos', async (req, res) => {
    try {
        const productos = await sequelize.query(
            `SELECT * FROM Producto WHERE estpro = 'A' ORDER BY nompro`,
            { type: QueryTypes.SELECT }
        );
        res.json(productos);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.json([]);
    }
});

// API para obtener tipos de membresía
router.get('/api/membresias', async (req, res) => {
    try {
        const membresias = await sequelize.query(
            `SELECT * FROM TipoMembresia WHERE esttm = 'A' ORDER BY pretm`,
            { type: QueryTypes.SELECT }
        );
        res.json(membresias);
    } catch (error) {
        console.error('Error al obtener membresías:', error);
        res.json([]);
    }
});

module.exports = router;
