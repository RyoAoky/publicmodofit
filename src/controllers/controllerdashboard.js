const { sequelize } = require('../database/conexionsqualize');
const { QueryTypes } = require('sequelize');
const helpers = require('../lib/helpers');

module.exports = {
    // Obtener datos del dashboard
    async getDashboardData(req, res) {
        try {
            const { tokenusu } = req.user;
            
            // Validar que el token existe en la sesión
            if (!tokenusu) {
                return res.status(401).json({ success: false, message: 'Sesión inválida' });
            }

            // Helper para formatear fecha
            const formatDate = (date) => {
                if (!date) return '-';
                return new Date(date).toLocaleDateString('es-PE');
            };

            // Helper para estado de pedido
            const getEstadoPedido = (estado) => {
                switch(estado) {
                    case 'P': return { texto: 'Pendiente', clase: 'warning', html: '<span class="badge bg-warning">Pendiente</span>' };
                    case 'C': 
                    case 'S': return { texto: 'Completado', clase: 'success', html: '<span class="badge bg-success">Completado</span>' };
                    case 'X': return { texto: 'Cancelado', clase: 'danger', html: '<span class="badge bg-danger">Cancelado</span>' };
                    default: return { texto: '-', clase: 'secondary', html: '<span class="badge bg-secondary">-</span>' };
                }
            };

            // Obtener membresía activa usando token
            const membresiaQuery = await sequelize.query(
                `SELECT TOP 1 m.fecfinmem, p.despro as tipomem
                 FROM Membresia m
                 INNER JOIN usuario u ON m.idusumem = u.idusu
                 INNER JOIN Producto p ON m.barcpro = p.barcpro
                 WHERE u.tokenusu = :tokenusu AND m.estamem = 'S' 
                 ORDER BY m.fecfinmem DESC`,
                {
                    replacements: { tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            let membresiaData = null;
            if (membresiaQuery.length > 0) {
                membresiaData = {
                    tipomem: membresiaQuery[0].tipomem,
                    fecfinmem: formatDate(membresiaQuery[0].fecfinmem)
                };
            }

            // Obtener historial de pedidos usando token
            const pedidosQuery = await sequelize.query(
                `SELECT TOP 5 v.idven, v.feccre, v.totalven, v.estven, 
                 (SELECT TOP 1 tp.destipopago 
                  FROM VentaPagos vp 
                  INNER JOIN TipoPago tp ON vp.codtipopago = tp.codtipopago 
                  WHERE vp.idven = v.idven) as destipopago
                 FROM Venta v
                 INNER JOIN usuario u ON v.dniusu = u.dniusu
                 WHERE u.tokenusu = :tokenusu 
                 ORDER BY v.feccre DESC`,
                {
                    replacements: { tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            const pedidosData = pedidosQuery.map(p => ({
                idven: p.idven,
                fecha: formatDate(p.feccre),
                total: parseFloat(p.totalven).toFixed(2),
                estado: getEstadoPedido(p.estven),
                metodopago: p.destipopago || 'TARJETA'
            }));

            // Obtener asistencias recientes usando token
            const asistenciasQuery = await sequelize.query(
                `SELECT TOP 5 a.fecasis 
                 FROM Asistencia a
                 INNER JOIN usuario u ON a.idusu = u.idusu
                 WHERE u.tokenusu = :tokenusu
                 ORDER BY a.fecasis DESC`,
                {
                    replacements: { tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            const asistenciasData = asistenciasQuery.map(a => ({
                fecha: formatDate(a.fecasis)
            }));

            res.json({
                success: true,
                data: {
                    membresia: membresiaData,
                    pedidos: pedidosData,
                    reservas: asistenciasData // Mantenemos la clave "reservas" para compatibilidad con frontend
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
            const tokenusu = req.user.tokenusu;

            // Validar que el token existe en la sesión
            if (!tokenusu) {
                return res.status(401).json({ success: false, message: 'Sesión inválida' });
            }

            // Usar tokenusu para identificar al usuario a actualizar
            const result = await sequelize.query(
                `UPDATE usuario SET nomusu = :nombre, apellusu = :apellido, contacusu = :telefono 
                 WHERE tokenusu = :tokenusu`,
                {
                    replacements: { nombre, apellido, telefono, tokenusu },
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
            const tokenusu = req.user.tokenusu;

            // Validar que el token existe en la sesión
            if (!tokenusu) {
                return res.status(401).json({ success: false, message: 'Sesión inválida' });
            }

            // Verificar contraseña actual usando tokenusu
            const usuario = await sequelize.query(
                `SELECT passusu FROM usuario WHERE tokenusu = :tokenusu`,
                {
                    replacements: { tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            if (!usuario || usuario.length === 0) {
                return res.status(403).json({ success: false, message: 'Acceso denegado' });
            }

            const passwordValido = await helpers.matchPassword(passwordActual, usuario[0].passusu);
            if (!passwordValido) {
                return res.json({ success: false, message: 'La contraseña actual es incorrecta' });
            }

            // Encriptar nueva contraseña
            const hashedPassword = await helpers.EncriptarPass(passwordNuevo);

            // Actualizar contraseña usando tokenusu
            await sequelize.query(
                `UPDATE usuario SET passusu = :password WHERE tokenusu = :tokenusu`,
                {
                    replacements: { password: hashedPassword, tokenusu },
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
            const tokenusu = req.user.tokenusu;

            // Validar que el token existe en la sesión
            if (!tokenusu) {
                return res.status(401).json({ success: false, message: 'Sesión inválida' });
            }

            const membresias = await sequelize.query(
                `SELECT 
                    m.fecinimem, 
                    m.fecfinmem, 
                    m.estamem as estmem_cod,
                    em.descmem as estmem,
                    p.despro as tipomem,
                    COALESCE(v.totalven, 0) as premem
                 FROM Membresia m
                 INNER JOIN usuario u ON m.idusumem = u.idusu
                 INNER JOIN Producto p ON m.barcpro = p.barcpro
                 INNER JOIN estados_membresia em ON m.estamem = em.estamem
                 LEFT JOIN Venta v ON m.idven = v.idven
                 WHERE u.tokenusu = :tokenusu 
                 ORDER BY m.fecfinmem DESC`,
                {
                    replacements: { tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            // Sanitizar respuesta - no exponer campos internos sensibles
            const sanitizedData = membresias.map(m => ({
                fecinimem: m.fecinimem,
                fecfinmem: m.fecfinmem,
                estmem_cod: m.estmem_cod,
                estmem: m.estmem,
                tipomem: m.tipomem,
                premem: m.premem
            }));

            res.json({ success: true, data: sanitizedData });
        } catch (error) {
            console.error('Error al obtener membresías:', error);
            res.json({ success: false, message: 'Error al cargar membresías' });
        }
    },

    // Obtener historial de pedidos
    async getPedidosData(req, res) {
        try {
            const tokenusu = req.user.tokenusu;

            // Validar que el token existe en la sesión
            if (!tokenusu) {
                return res.status(401).json({ success: false, message: 'Sesión inválida' });
            }

            const pedidos = await sequelize.query(
                `SELECT v.idven, v.feccre, v.totalven, v.estven, v.numser, v.numcom,
                 (SELECT TOP 1 tp.destipopago 
                  FROM VentaPagos vp 
                  INNER JOIN TipoPago tp ON vp.codtipopago = tp.codtipopago 
                  WHERE vp.idven = v.idven) as destipopago 
                 FROM Venta v
                 INNER JOIN usuario u ON v.dniusu = u.dniusu
                 WHERE u.tokenusu = :tokenusu 
                 ORDER BY v.feccre DESC`,
                {
                    replacements: { tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            // Sanitizar respuesta - no exponer campos internos sensibles
            const sanitizedData = pedidos.map(p => ({
                idven: p.idven,
                feccre: p.feccre,
                totalven: p.totalven,
                estven: p.estven,
                numser: p.numser,
                numcom: p.numcom,
                destipopago: p.destipopago
            }));

            res.json({ success: true, data: sanitizedData });
        } catch (error) {
            console.error('Error al obtener pedidos:', error);
            res.json({ success: false, message: 'Error al cargar pedidos' });
        }
    },

    // Obtener detalle de un pedido
    async getPedidoDetalle(req, res) {
        try {
            const { id } = req.params;
            const tokenusu = req.user.tokenusu;

            // Validar que el token existe en la sesión
            if (!tokenusu) {
                return res.status(401).json({ success: false, message: 'Sesión inválida' });
            }

            // Validar ownership por token antes de retornar detalle
            // Usamos JOIN con usuario para verificar que el pedido pertenece al usuario autenticado
            const pedido = await sequelize.query(
                `SELECT v.idven, v.feccre, v.totalven, v.estven, v.numser, v.numcom,
                        vd.canpro, vd.prepro, vd.subtotal,
                        pr.despro as nompro, pr.barcpro
                 FROM Venta v
                 INNER JOIN usuario u ON v.dniusu = u.dniusu
                 INNER JOIN VentaDetalle vd ON v.idven = vd.idven
                 INNER JOIN Producto pr ON vd.barcpro = pr.barcpro
                 WHERE v.idven = :id AND u.tokenusu = :tokenusu`,
                {
                    replacements: { id, tokenusu },
                    type: QueryTypes.SELECT
                }
            );

            // Si no hay resultados, el pedido no existe o no pertenece al usuario
            // Retornamos error de autorización sin revelar si el pedido existe (Req 4.3)
            if (!pedido || pedido.length === 0) {
                return res.status(403).json({ success: false, message: 'Acceso denegado' });
            }

            // Sanitizar respuesta - no exponer campos internos sensibles como idusu
            const sanitizedData = pedido.map(item => ({
                idven: item.idven,
                feccre: item.feccre,
                totalven: item.totalven,
                estven: item.estven,
                numser: item.numser,
                numcom: item.numcom,
                nompro: item.nompro,
                barcpro: item.barcpro,
                canpro: item.canpro,
                prepro: item.prepro,
                subtotal: item.subtotal
            }));

            res.json({ success: true, data: sanitizedData });
        } catch (error) {
            console.error('Error al obtener detalle del pedido:', error);
            res.json({ success: false, message: 'Error al cargar detalle del pedido' });
        }
    }
};
