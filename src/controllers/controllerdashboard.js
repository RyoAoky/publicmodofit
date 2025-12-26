const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');
const helpers = require('../lib/helpers');

module.exports = {
    // Obtener datos del dashboard
    async getDashboardData(req, res) {
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

            res.json({
                success: true,
                data: {
                    membresia: membresia[0] || null,
                    pedidos: pedidos || [],
                    reservas: reservas || []
                }
            });
        } catch (error) {
            console.error('Error al obtener datos del dashboard:', error);
            res.json({ success: false, message: 'Error al cargar datos' });
        }
    },

    // Actualizar perfil
    async postActualizarPerfil(req, res) {
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

            res.json({ success: true, message: 'Perfil actualizado correctamente' });
        } catch (error) {
            console.error('Error al actualizar perfil:', error);
            res.json({ success: false, message: 'Error al actualizar perfil' });
        }
    },

    // Cambiar contraseña
    async postCambiarPassword(req, res) {
        try {
            const { passwordActual, passwordNuevo } = req.body;
            const idCliente = req.user.idcli;

            // Verificar contraseña actual
            const usuario = await sequelize.query(
                `SELECT passcli FROM Cliente WHERE idcli = :idCliente`,
                {
                    replacements: { idCliente },
                    type: QueryTypes.SELECT
                }
            );

            const passwordValido = await helpers.MatchPassword(passwordActual, usuario[0].passcli);
            if (!passwordValido) {
                return res.json({ success: false, message: 'La contraseña actual es incorrecta' });
            }

            // Encriptar nueva contraseña
            const hashedPassword = await helpers.EncriptarPass(passwordNuevo);

            await sequelize.query(
                `UPDATE Cliente SET passcli = :password WHERE idcli = :idCliente`,
                {
                    replacements: { password: hashedPassword, idCliente },
                    type: QueryTypes.UPDATE
                }
            );

            res.json({ success: true, message: 'Contraseña actualizada correctamente' });
        } catch (error) {
            console.error('Error al cambiar contraseña:', error);
            res.json({ success: false, message: 'Error al cambiar contraseña' });
        }
    },

    // Obtener historial de membresías
    async getMembresiasData(req, res) {
        try {
            const idCliente = req.user.idcli;

            const membresias = await sequelize.query(
                `SELECT * FROM Membresia WHERE idcli = :idCliente ORDER BY fecfinmem DESC`,
                {
                    replacements: { idCliente },
                    type: QueryTypes.SELECT
                }
            );

            res.json({ success: true, data: membresias });
        } catch (error) {
            console.error('Error al obtener membresías:', error);
            res.json({ success: false, message: 'Error al cargar membresías' });
        }
    },

    // Obtener historial de pedidos
    async getPedidosData(req, res) {
        try {
            const idCliente = req.user.idcli;

            const pedidos = await sequelize.query(
                `SELECT * FROM Pedido WHERE idcli = :idCliente ORDER BY fecped DESC`,
                {
                    replacements: { idCliente },
                    type: QueryTypes.SELECT
                }
            );

            res.json({ success: true, data: pedidos });
        } catch (error) {
            console.error('Error al obtener pedidos:', error);
            res.json({ success: false, message: 'Error al cargar pedidos' });
        }
    },

    // Obtener detalle de un pedido
    async getPedidoDetalle(req, res) {
        try {
            const { id } = req.params;
            const idCliente = req.user.idcli;

            const pedido = await sequelize.query(
                `SELECT p.*, dp.*, pr.nompro 
                 FROM Pedido p
                 INNER JOIN DetallePedido dp ON p.idped = dp.idped
                 INNER JOIN Producto pr ON dp.idpro = pr.idpro
                 WHERE p.idped = :id AND p.idcli = :idCliente`,
                {
                    replacements: { id, idCliente },
                    type: QueryTypes.SELECT
                }
            );

            res.json({ success: true, data: pedido });
        } catch (error) {
            console.error('Error al obtener detalle del pedido:', error);
            res.json({ success: false, message: 'Error al cargar detalle del pedido' });
        }
    }
};
