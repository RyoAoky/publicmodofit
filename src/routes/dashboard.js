const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../lib/auth');
const { sequelize, QueryTypes } = require('../database/conexionsqualize');

// Dashboard principal del cliente
router.get('/', isLoggedIn, async (req, res) => {
    try {
        const idCliente = req.user.idcli;
        
        // Obtener membresía activa
        const membresia = await sequelize.query(
            `SELECT TOP 1 * FROM Membresia 
             WHERE idcli = :idCliente AND estmem = 'A' 
             ORDER BY fecfinmem DESC`,
            {
                replacements: { idCliente },
                type: QueryTypes.SELECT
            }
        );

        // Obtener historial de pedidos
        const pedidos = await sequelize.query(
            `SELECT TOP 5 * FROM Pedido 
             WHERE idcli = :idCliente 
             ORDER BY fecped DESC`,
            {
                replacements: { idCliente },
                type: QueryTypes.SELECT
            }
        );

        // Obtener reservas activas
        const reservas = await sequelize.query(
            `SELECT TOP 5 * FROM Reserva 
             WHERE idcli = :idCliente AND estres = 'A'
             ORDER BY fecres DESC`,
            {
                replacements: { idCliente },
                type: QueryTypes.SELECT
            }
        );

        res.render('dashboard/index', {
            layout: 'dashboard',
            title: 'Mi Dashboard - ModoFit',
            membresia: membresia[0] || null,
            pedidos: pedidos || [],
            reservas: reservas || []
        });
    } catch (error) {
        console.error('Error en dashboard:', error);
        res.render('dashboard/index', {
            layout: 'dashboard',
            title: 'Mi Dashboard - ModoFit',
            membresia: null,
            pedidos: [],
            reservas: []
        });
    }
});

// Mi perfil
router.get('/perfil', isLoggedIn, (req, res) => {
    res.render('dashboard/perfil', {
        layout: 'dashboard',
        title: 'Mi Perfil - ModoFit'
    });
});

// Actualizar perfil
router.post('/perfil', isLoggedIn, async (req, res) => {
    try {
        const { nombre, apellido, telefono } = req.body;
        const idCliente = req.user.idcli;

        await sequelize.query(
            `UPDATE Cliente SET nomcli = :nombre, apecli = :apellido, celcli = :telefono 
             WHERE idcli = :idCliente`,
            {
                replacements: { nombre, apellido, telefono, idCliente },
                type: QueryTypes.UPDATE
            }
        );

        req.flash('success', 'Perfil actualizado correctamente');
        res.redirect('/dashboard/perfil');
    } catch (error) {
        console.error('Error al actualizar perfil:', error);
        req.flash('message', 'Error al actualizar perfil');
        res.redirect('/dashboard/perfil');
    }
});

// Mis membresías
router.get('/membresias', isLoggedIn, async (req, res) => {
    try {
        const idCliente = req.user.idcli;
        
        const membresias = await sequelize.query(
            `SELECT * FROM Membresia WHERE idcli = :idCliente ORDER BY fecfinmem DESC`,
            {
                replacements: { idCliente },
                type: QueryTypes.SELECT
            }
        );

        res.render('dashboard/membresias', {
            layout: 'dashboard',
            title: 'Mis Membresías - ModoFit',
            membresias: membresias || []
        });
    } catch (error) {
        console.error('Error en membresías:', error);
        res.render('dashboard/membresias', {
            layout: 'dashboard',
            title: 'Mis Membresías - ModoFit',
            membresias: []
        });
    }
});

// Mis pedidos
router.get('/pedidos', isLoggedIn, async (req, res) => {
    try {
        const idCliente = req.user.idcli;
        
        const pedidos = await sequelize.query(
            `SELECT * FROM Pedido WHERE idcli = :idCliente ORDER BY fecped DESC`,
            {
                replacements: { idCliente },
                type: QueryTypes.SELECT
            }
        );

        res.render('dashboard/pedidos', {
            layout: 'dashboard',
            title: 'Mis Pedidos - ModoFit',
            pedidos: pedidos || []
        });
    } catch (error) {
        console.error('Error en pedidos:', error);
        res.render('dashboard/pedidos', {
            layout: 'dashboard',
            title: 'Mis Pedidos - ModoFit',
            pedidos: []
        });
    }
});

module.exports = router;
